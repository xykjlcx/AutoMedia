import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { db } from '../db/index'
import { aiSettings } from '../db/schema'
import { eq } from 'drizzle-orm'

export interface AIConfig {
  provider: string // 'openai' | 'anthropic'
  baseUrl: string
  apiKey: string
  fastModel: string
  qualityModel: string
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  baseUrl: '',
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  fastModel: 'gpt-4o-mini',
  qualityModel: 'gpt-4o',
}

// 从数据库读取 AI 配置
export function getAIConfig(): AIConfig {
  try {
    const rows = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).all()
    if (rows.length === 0) return DEFAULT_CONFIG

    const row = rows[0]
    return {
      provider: row.provider,
      baseUrl: row.baseUrl || '',
      apiKey: row.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      fastModel: row.fastModel,
      qualityModel: row.qualityModel,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

// 根据 API 协议创建模型实例
function createModel(config: AIConfig, modelName: string): LanguageModel {
  if (config.provider === 'anthropic') {
    const provider = createAnthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      // 第三方兼容服务可能需要 Authorization header
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    })
    return provider(modelName)
  }

  // OpenAI Chat Completions 协议
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || 'https://api.openai.com/v1',
  })
  return provider(modelName)
}

// 获取当前配置的模型
export function getModels() {
  const config = getAIConfig()
  return {
    fast: createModel(config, config.fastModel),
    quality: createModel(config, config.qualityModel),
  }
}

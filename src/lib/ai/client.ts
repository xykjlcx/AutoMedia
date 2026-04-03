import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { db } from '../db/index'
import { aiSettings } from '../db/schema'
import { eq } from 'drizzle-orm'

export interface AIConfig {
  provider: string
  baseUrl: string
  apiKey: string
  fastModel: string
  qualityModel: string
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'anthropic',
  baseUrl: '',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  fastModel: 'claude-haiku-4-5-20251001',
  qualityModel: 'claude-sonnet-4-6',
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
      // DB 里存的 key 优先，没有则 fallback 到环境变量
      apiKey: row.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
      fastModel: row.fastModel,
      qualityModel: row.qualityModel,
    }
  } catch {
    // 表可能还不存在（迁移前）
    return DEFAULT_CONFIG
  }
}

// 根据 provider 和模型名创建 LanguageModel 实例
function createModel(config: AIConfig, modelName: string): LanguageModel {
  switch (config.provider) {
    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })
      return provider(modelName)
    }
    case 'openai-compatible': {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || 'https://api.openai.com/v1',
      })
      return provider(modelName)
    }
    case 'google': {
      const provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })
      return provider(modelName)
    }
    default: {
      // 默认当 OpenAI 兼容处理（中转站通常都兼容 OpenAI 格式）
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || 'https://api.openai.com/v1',
      })
      return provider(modelName)
    }
  }
}

// 获取当前配置的模型（每次调用都读取最新配置，支持热更新）
export function getModels() {
  const config = getAIConfig()
  return {
    fast: createModel(config, config.fastModel),
    quality: createModel(config, config.qualityModel),
  }
}

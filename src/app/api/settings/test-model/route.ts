import { NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { getAIConfig } from '@/lib/ai/client'

export async function POST(request: Request) {
  const body = await request.json() as {
    modelType: 'fast' | 'quality'
  }

  const config = getAIConfig()
  const modelName = body.modelType === 'fast' ? config.fastModel : config.qualityModel
  const prompt = '请用一句话介绍你自己，包括你的模型名称。'

  try {
    let model
    if (config.provider === 'anthropic') {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })
      model = provider(modelName)
    } else {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || 'https://api.openai.com/v1',
      })
      model = provider(modelName)
    }

    const startTime = Date.now()
    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 200,
    })
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      modelName,
      prompt,
      reply: result.text,
      duration,
      usage: result.usage,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      success: false,
      modelName,
      prompt,
      error: msg,
    })
  }
}

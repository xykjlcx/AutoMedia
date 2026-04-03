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
        // MiniMax 等第三方兼容服务需要 Authorization header
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
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

    // result.text 可能为空（某些兼容 API 的响应格式略有差异）
    // 尝试多种方式提取回复文本
    let replyText = result.text || ''
    if (!replyText && result.response) {
      // 从原始响应中提取
      const resp = result.response as Record<string, unknown>
      if (resp.messages && Array.isArray(resp.messages)) {
        const lastMsg = resp.messages[resp.messages.length - 1] as Record<string, unknown>
        if (lastMsg?.content) {
          if (typeof lastMsg.content === 'string') {
            replyText = lastMsg.content
          } else if (Array.isArray(lastMsg.content)) {
            replyText = (lastMsg.content as Array<Record<string, string>>)
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('')
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      modelName,
      prompt,
      reply: replyText || '(模型返回了空内容)',
      duration,
      usage: result.usage,
      // 临时调试：返回 result 的 key 列表
      resultKeys: Object.keys(result),
    })
  } catch (err: unknown) {
    // 提取更详细的错误信息
    let errorDetail = ''

    if (err instanceof Error) {
      errorDetail = err.message

      // Anthropic SDK 的错误对象可能包含 status 和 response
      const apiErr = err as Record<string, unknown>
      if (apiErr.status) {
        errorDetail = `HTTP ${apiErr.status}: ${err.message}`
      }
      if (apiErr.error && typeof apiErr.error === 'object') {
        errorDetail += ` | ${JSON.stringify(apiErr.error)}`
      }
      // 有些 SDK 错误包含 responseBody
      if (apiErr.responseBody) {
        errorDetail += ` | Body: ${String(apiErr.responseBody).slice(0, 500)}`
      }
    } else {
      errorDetail = String(err)
    }

    return NextResponse.json({
      success: false,
      modelName,
      prompt,
      error: errorDetail,
      // 返回当前使用的配置（脱敏），方便调试
      debug: {
        provider: config.provider,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKey,
        apiKeyPrefix: config.apiKey ? config.apiKey.slice(0, 8) + '...' : '(empty)',
      },
    })
  }
}

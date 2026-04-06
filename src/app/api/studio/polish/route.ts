import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModels } from '@/lib/ai/client'

const TONE_PROMPTS: Record<string, string> = {
  casual: '改写为更口语化、自然的表达，像朋友之间聊天的语气',
  formal: '改写为更正式、专业的书面表达',
  concise: '精简表达，删除冗余词句，保留核心意思',
  expand: '丰富表达，补充细节和过渡，让内容更饱满',
}

const PLATFORM_HINTS: Record<string, string> = {
  xhs: '当前平台是小红书，风格活泼亲切',
  twitter: '当前平台是 Twitter，风格简洁有力',
  article: '当前平台是公众号长文，风格专业有深度',
}

export async function POST(req: NextRequest) {
  try {
    const { text, tone, platform, context } = await req.json()
    if (!text || !tone) {
      return NextResponse.json({ error: '缺少 text 或 tone' }, { status: 400 })
    }

    const toneInstruction = TONE_PROMPTS[tone]
    if (!toneInstruction) {
      return NextResponse.json({ error: `不支持的 tone: ${tone}` }, { status: 400 })
    }

    const systemPrompt = [
      '你是一位专业的中文编辑。用户会给你一段文本，你需要按照指定方向改写。',
      '只返回改写后的文本，不要解释、不要加引号、不要加前缀。',
      PLATFORM_HINTS[platform] || '',
    ].filter(Boolean).join('\n')

    const userPrompt = [
      `改写方向：${toneInstruction}`,
      context ? `上下文（仅供理解语境，不要改写这部分）：\n${context}` : '',
      `需要改写的文本：\n${text}`,
    ].filter(Boolean).join('\n\n')

    const { text: result } = await generateText({
      model: getModels().fast,
      system: systemPrompt,
      prompt: userPrompt,
    })

    return NextResponse.json({ result: result.trim() })
  } catch (err) {
    console.error('[polish] error:', err)
    return NextResponse.json({ error: '润色失败' }, { status: 500 })
  }
}

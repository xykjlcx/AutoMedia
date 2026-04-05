import { NextRequest, NextResponse } from 'next/server'
import { generateCoverImage, hasImageConfig } from '@/lib/studio/image-gen'

// 查询是否已配置图片生成 provider（前端用来决定是否显示"配图"按钮）
export async function GET() {
  return NextResponse.json({ configured: hasImageConfig() })
}

// 生成图片
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body?.prompt) {
    return NextResponse.json({ error: '缺少 prompt' }, { status: 400 })
  }
  try {
    const result = await generateCoverImage({
      prompt: body.prompt,
      aspectRatio: body.aspectRatio,
    })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

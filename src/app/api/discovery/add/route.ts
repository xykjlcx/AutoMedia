import { NextResponse } from 'next/server'
import { addSuggestionToSources } from '@/lib/discovery/recommend'

// 将推荐源添加到用户源列表
export async function POST(request: Request) {
  try {
    const body = await request.json() as { suggestionId: string }
    if (!body.suggestionId) {
      return NextResponse.json({ error: '缺少 suggestionId' }, { status: 400 })
    }

    const result = addSuggestionToSources(body.suggestionId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

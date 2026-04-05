import { NextResponse } from 'next/server'
import { getCachedSuggestions, generateRecommendations } from '@/lib/discovery/recommend'

// 获取推荐列表（有缓存就返回缓存，没有就生成）
export async function GET() {
  try {
    let suggestions = getCachedSuggestions()

    // 没有缓存的推荐，自动生成
    if (suggestions.length === 0) {
      suggestions = await generateRecommendations()
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

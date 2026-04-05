import { NextResponse } from 'next/server'
import { clearPendingSuggestions, generateRecommendations } from '@/lib/discovery/recommend'

// 强制重新生成推荐
export async function POST() {
  try {
    // 清除现有 pending 推荐
    clearPendingSuggestions()

    // 重新生成
    const suggestions = await generateRecommendations()
    return NextResponse.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

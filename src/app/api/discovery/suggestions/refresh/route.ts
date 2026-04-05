import { NextResponse } from 'next/server'
import { refreshRecommendations } from '@/lib/discovery/recommend'

// 强制重新生成推荐
// 先执行 AI 生成，成功后再在事务里替换旧 pending；失败时旧推荐保持不变
export async function POST() {
  try {
    const suggestions = await refreshRecommendations()
    return NextResponse.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

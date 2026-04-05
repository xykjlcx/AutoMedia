import { NextRequest, NextResponse } from 'next/server'
import { getReadingStats } from '@/lib/analytics/stats'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') === 'month' ? 'month' : 'week'

    const stats = getReadingStats(period)
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[analytics/stats] 查询失败:', err)
    return NextResponse.json(
      { error: '统计数据查询失败' },
      { status: 500 }
    )
  }
}

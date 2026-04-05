import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyInsight, getWeeklyInsight, getLatestWeeklyInsight } from '@/lib/digest/weekly-insight'

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get('week')
  const data = weekStart ? getWeeklyInsight(weekStart) : getLatestWeeklyInsight()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const weekStart = body?.weekStart
  try {
    const result = await generateWeeklyInsight(weekStart)
    if (!result) return NextResponse.json({ error: '该周无数据或生成失败' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

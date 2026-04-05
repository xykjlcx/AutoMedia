import { NextResponse } from 'next/server'
import { extractEntitiesForDate } from '@/lib/digest/entity-extract'

// 手动触发实体提取
export async function POST(request: Request) {
  const body = await request.json()
  const date = body.date as string

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '请提供有效日期 (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const result = await extractEntitiesForDate(date)
    return NextResponse.json({
      message: `实体提取完成`,
      ...result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateDailyTldr, getDailyTldr } from '@/lib/digest/tldr'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: '缺少 date 参数' }, { status: 400 })
  const data = getDailyTldr(date)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = body?.date
  if (!date) return NextResponse.json({ error: '缺少 date 参数' }, { status: 400 })
  try {
    const result = await generateDailyTldr(date)
    if (!result) return NextResponse.json({ error: '该日期无精选条目或生成失败' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

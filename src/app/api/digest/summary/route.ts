import { NextResponse } from 'next/server'
import { generateWeeklySummary } from '@/lib/ai/weekly-summary'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'weekly' // weekly | monthly
  const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const date = new Date(dateStr)

  let startDate: string, endDate: string

  if (type === 'monthly') {
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    startDate = format(start, 'yyyy-MM-dd')
    endDate = format(end, 'yyyy-MM-dd')
  } else {
    // 默认取最近 7 天
    startDate = format(subDays(date, 6), 'yyyy-MM-dd')
    endDate = format(date, 'yyyy-MM-dd')
  }

  const summary = await generateWeeklySummary(startDate, endDate)

  return NextResponse.json({
    type,
    startDate,
    endDate,
    ...summary,
  })
}

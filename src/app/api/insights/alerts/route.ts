import { NextResponse } from 'next/server'
import { getRecentAlerts } from '@/lib/digest/cross-source-alert'

// 获取最近的跨源预警
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '7')

  const alerts = getRecentAlerts(days)

  return NextResponse.json({ alerts })
}

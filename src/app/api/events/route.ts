import { NextResponse } from 'next/server'
import { trackEvent } from '@/lib/analytics/track'

export async function POST(req: Request) {
  const { eventType, targetType, targetId, metadata } = await req.json()

  if (!eventType || !targetType || !targetId) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
  }

  trackEvent(eventType, targetType, targetId, metadata)
  return NextResponse.json({ ok: true })
}

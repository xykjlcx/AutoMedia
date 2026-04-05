import { NextRequest, NextResponse } from 'next/server'
import { addToQueue, listQueue } from '@/lib/reading-queue/queries'

export async function GET() {
  const items = listQueue()
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const digestItemId = body?.digestItemId
  if (!digestItemId) {
    return NextResponse.json({ error: '缺少 digestItemId' }, { status: 400 })
  }
  const id = addToQueue(digestItemId)
  return NextResponse.json({ id })
}

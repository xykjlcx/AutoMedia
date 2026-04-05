import { NextRequest, NextResponse } from 'next/server'
import { listSubscriptions, subscribe } from '@/lib/insights/entity-subscription'

export async function GET() {
  return NextResponse.json({ items: listSubscriptions() })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const entityId = body?.entityId
  if (!entityId) {
    return NextResponse.json({ error: '缺少 entityId' }, { status: 400 })
  }
  const id = subscribe(entityId)
  return NextResponse.json({ id })
}

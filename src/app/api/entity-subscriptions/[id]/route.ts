import { NextRequest, NextResponse } from 'next/server'
import { unsubscribe } from '@/lib/insights/entity-subscription'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  unsubscribe(id)
  return NextResponse.json({ ok: true })
}

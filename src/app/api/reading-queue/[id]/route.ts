import { NextRequest, NextResponse } from 'next/server'
import { removeFromQueue, markRead } from '@/lib/reading-queue/queries'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  markRead(id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  removeFromQueue(id)
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { favorites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.delete(favorites).where(eq(favorites.id, id))
  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { tags?: string[]; note?: string }

  const updates: Record<string, unknown> = {}
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.note !== undefined) updates.note = body.note

  await db.update(favorites).set(updates).where(eq(favorites.id, id))
  return NextResponse.json({ success: true })
}

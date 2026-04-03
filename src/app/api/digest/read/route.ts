import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { digestItems } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

export async function POST(request: Request) {
  const body = await request.json() as { ids: string[] }
  if (!body.ids?.length) return NextResponse.json({ success: false })
  await db.update(digestItems).set({ isRead: true }).where(inArray(digestItems.id, body.ids))
  return NextResponse.json({ success: true, count: body.ids.length })
}

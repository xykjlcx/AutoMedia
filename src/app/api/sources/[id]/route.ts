import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { sourceConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.name !== undefined) updates.name = body.name
    if (body.icon !== undefined) updates.icon = body.icon
    if (body.maxItems !== undefined) updates.maxItems = body.maxItems
    if (body.rssUrl !== undefined) updates.rssUrl = body.rssUrl

    await db.update(sourceConfigs).set(updates).where(eq(sourceConfigs.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const source = db.select().from(sourceConfigs).where(eq(sourceConfigs.id, id)).all()
    if (source.length === 0) return NextResponse.json({ error: '源不存在' }, { status: 404 })
    if (source[0].type !== 'custom-rss') return NextResponse.json({ error: '不能删除内置源' }, { status: 403 })

    await db.delete(sourceConfigs).where(eq(sourceConfigs.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

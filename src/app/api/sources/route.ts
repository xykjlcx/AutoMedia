import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { sourceConfigs } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'

export async function GET() {
  try {
    const sources = db.select().from(sourceConfigs).orderBy(asc(sourceConfigs.sortOrder)).all()
    return NextResponse.json({ sources })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name: string; icon?: string; rssUrl: string }
    const id = `custom-${Date.now()}`
    const maxSort = db.select().from(sourceConfigs).all().length

    await db.insert(sourceConfigs).values({
      id,
      name: body.name,
      icon: body.icon || '📰',
      type: 'custom-rss',
      rssUrl: body.rssUrl,
      rssPath: '',
      targetUrl: '',
      enabled: true,
      maxItems: 20,
      sortOrder: maxSort,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { sourceConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// POST /api/sources/twitter
// Body: { username?: string, type?: 'public' | 'private', displayName?: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const username: string = (body?.username || '').trim().replace(/^@/, '')
  const type: 'public' | 'private' = body?.type === 'private' ? 'private' : 'public'
  const displayName: string = (body?.displayName || '').trim()

  if (type === 'public' && !username) {
    return NextResponse.json({ error: '缺少 username' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (type === 'public') {
    const id = `twitter-${username.toLowerCase()}`
    // 防重复
    const existing = db.select().from(sourceConfigs).where(eq(sourceConfigs.id, id)).get()
    if (existing) {
      return NextResponse.json({ id, duplicate: true })
    }

    const name = displayName || `Twitter @${username}`
    const sortOrder = 100 // 放在默认源之后

    db.insert(sourceConfigs).values({
      id,
      name,
      icon: '🐦',
      type: 'twitter-public',
      rssPath: `/twitter/user/${username}`,
      rssUrl: '',
      targetUrl: `https://x.com/${username}`,
      enabled: true,
      maxItems: 10,
      sortOrder,
      createdAt: now,
    }).run()

    return NextResponse.json({ id })
  } else {
    // private：固定 id 'twitter-feed'（只允许一个私域时间线）
    const id = 'twitter-feed'
    const existing = db.select().from(sourceConfigs).where(eq(sourceConfigs.id, id)).get()
    if (existing) {
      // 已存在则确保 type 正确并启用
      db.update(sourceConfigs).set({
        type: 'twitter-private',
        targetUrl: 'https://x.com/home',
        enabled: true,
      }).where(eq(sourceConfigs.id, id)).run()
      return NextResponse.json({ id, updated: true })
    }

    db.insert(sourceConfigs).values({
      id,
      name: displayName || 'Twitter 时间线',
      icon: '🐦',
      type: 'twitter-private',
      rssPath: '',
      rssUrl: '',
      targetUrl: 'https://x.com/home',
      enabled: true,
      maxItems: 30,
      sortOrder: 99,
      createdAt: now,
    }).run()

    return NextResponse.json({ id })
  }
}

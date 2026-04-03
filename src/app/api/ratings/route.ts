import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'
import { userRatings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const body = await request.json() as { digestItemId: string; rating: 'like' | 'dislike' }
  const { digestItemId, rating } = body

  if (!digestItemId || !['like', 'dislike'].includes(rating)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 })
  }

  // upsert：同一条目只保留最新评价
  const existing = await db.select().from(userRatings)
    .where(eq(userRatings.digestItemId, digestItemId)).limit(1)

  if (existing.length > 0) {
    await db.update(userRatings).set({
      rating,
      createdAt: new Date().toISOString(),
    }).where(eq(userRatings.id, existing[0].id))
    return NextResponse.json({ id: existing[0].id, rating })
  }

  const id = uuid()
  await db.insert(userRatings).values({
    id,
    digestItemId,
    rating,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ id, rating })
}

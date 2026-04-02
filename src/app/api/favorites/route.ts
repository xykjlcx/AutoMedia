import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'
import { favorites } from '@/lib/db/schema'
import { getFavorites } from '@/lib/db/queries'

export async function GET() {
  const items = await getFavorites()
  return NextResponse.json({ favorites: items })
}

export async function POST(request: Request) {
  const body = await request.json() as { digestItemId: string; tags?: string[]; note?: string }

  const id = uuid()
  await db.insert(favorites).values({
    id,
    digestItemId: body.digestItemId,
    tags: body.tags || [],
    note: body.note || '',
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ id })
}

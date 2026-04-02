import { NextResponse } from 'next/server'
import { getDigestByDate, getDigestDates } from '@/lib/db/queries'
import { db } from '@/lib/db/index'
import { favorites } from '@/lib/db/schema'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params
  const items = await getDigestByDate(date)

  // 查询收藏状态，同时返回 favoriteId
  const allFavorites = await db.select().from(favorites)
  const favoriteMap = new Map(allFavorites.map(f => [f.digestItemId, f.id]))

  const itemsWithFavorite = items.map(item => ({
    ...item,
    isFavorited: favoriteMap.has(item.id),
    favoriteId: favoriteMap.get(item.id) || null,
  }))

  // 按来源分组
  const grouped: Record<string, typeof itemsWithFavorite> = {}
  for (const item of itemsWithFavorite) {
    if (!grouped[item.source]) grouped[item.source] = []
    grouped[item.source].push(item)
  }

  const dates = await getDigestDates()

  return NextResponse.json({ date, groups: grouped, availableDates: dates })
}

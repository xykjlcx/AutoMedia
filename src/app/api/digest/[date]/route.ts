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

  // 查询收藏状态
  const allFavorites = await db.select().from(favorites)
  const favoritedIds = new Set(allFavorites.map(f => f.digestItemId))

  const itemsWithFavorite = items.map(item => ({
    ...item,
    isFavorited: favoritedIds.has(item.id),
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

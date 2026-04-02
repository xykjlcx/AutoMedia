import { db } from './index'
import { digestItems, digestRuns, favorites, rawItems } from './schema'
import { eq, desc, and } from 'drizzle-orm'

// 获取指定日期的日报
export async function getDigestByDate(date: string) {
  return db.select().from(digestItems).where(eq(digestItems.digestDate, date)).orderBy(digestItems.source, desc(digestItems.aiScore))
}

// 获取日报执行状态
export async function getDigestRunStatus(date: string) {
  return db.select().from(digestRuns).where(eq(digestRuns.digestDate, date)).orderBy(desc(digestRuns.startedAt)).limit(1)
}

// 获取所有有日报的日期列表
export async function getDigestDates() {
  const results = await db.selectDistinct({ date: digestItems.digestDate }).from(digestItems).orderBy(desc(digestItems.digestDate))
  return results.map(r => r.date)
}

// 收藏相关
export async function getFavorites() {
  return db.select({
    favorite: favorites,
    digestItem: digestItems,
  }).from(favorites).innerJoin(digestItems, eq(favorites.digestItemId, digestItems.id)).orderBy(desc(favorites.createdAt))
}

export async function isFavorited(digestItemId: string) {
  const result = await db.select().from(favorites).where(eq(favorites.digestItemId, digestItemId)).limit(1)
  return result.length > 0
}

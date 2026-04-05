import Database from 'better-sqlite3'
import { existsSync } from 'fs'

// 直接用 better-sqlite3 做聚合查询，比 Drizzle ORM 更高效
function getDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || './data/automedia.db'
  if (!existsSync(dbPath)) {
    throw new Error('数据库文件不存在')
  }
  const db = new Database(dbPath, { readonly: true })
  db.pragma('journal_mode = WAL')
  return db
}

export interface StatsResult {
  period: { start: string; end: string }
  summary: {
    totalReads: number
    totalDays: number
    avgPerDay: number
    recommendHitRate: number // 推荐命中率（被阅读的推荐条目占比）
  }
  byDate: Array<{ date: string; count: number }>
  bySource: Array<{ source: string; count: number }>
  byHour: Array<{ hour: number; count: number }>
  topArticles: Array<{ title: string; source: string; readCount: number }>
}

/**
 * 聚合阅读统计数据
 * @param period 'week' | 'month'
 */
export function getReadingStats(period: 'week' | 'month'): StatsResult {
  const db = getDb()

  try {
    // 计算时间范围
    const now = new Date()
    const daysBack = period === 'week' ? 7 : 30
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysBack + 1)
    const start = startDate.toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]

    // 总阅读量
    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM user_events
      WHERE event_type = 'read'
        AND created_at >= ?
    `).get(start) as { count: number } | undefined
    const totalReads = totalRow?.count ?? 0

    // 活跃天数（有阅读事件的天数）
    const daysRow = db.prepare(`
      SELECT COUNT(DISTINCT DATE(created_at)) as count FROM user_events
      WHERE event_type = 'read'
        AND created_at >= ?
    `).get(start) as { count: number } | undefined
    const totalDays = daysRow?.count ?? 0

    // 日均阅读
    const avgPerDay = totalDays > 0 ? Math.round((totalReads / totalDays) * 10) / 10 : 0

    // 推荐命中率：被阅读的推荐条目 / 总推荐条目
    const hitRateRow = db.prepare(`
      SELECT
        COUNT(DISTINCT di.id) as total_recommended,
        COUNT(DISTINCT CASE WHEN ue.id IS NOT NULL THEN di.id END) as read_recommended
      FROM digest_items di
      LEFT JOIN user_events ue ON ue.target_id = di.id AND ue.event_type = 'read'
      WHERE di.digest_date >= ?
    `).get(start) as { total_recommended: number; read_recommended: number } | undefined
    const recommendHitRate = hitRateRow && hitRateRow.total_recommended > 0
      ? Math.round((hitRateRow.read_recommended / hitRateRow.total_recommended) * 100)
      : 0

    // 按日期分布
    const byDate = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM user_events
      WHERE event_type = 'read'
        AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(start) as Array<{ date: string; count: number }>

    // 按来源分布（关联 digest_items 拿 source）
    const bySource = db.prepare(`
      SELECT di.source as source, COUNT(*) as count
      FROM user_events ue
      JOIN digest_items di ON ue.target_id = di.id
      WHERE ue.event_type = 'read'
        AND ue.created_at >= ?
      GROUP BY di.source
      ORDER BY count DESC
    `).all(start) as Array<{ source: string; count: number }>

    // 按小时分布
    const byHour = db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
      FROM user_events
      WHERE event_type = 'read'
        AND created_at >= ?
      GROUP BY hour
      ORDER BY hour
    `).all(start) as Array<{ hour: number; count: number }>

    // 热门文章 Top 10
    const topArticles = db.prepare(`
      SELECT di.title, di.source, COUNT(*) as readCount
      FROM user_events ue
      JOIN digest_items di ON ue.target_id = di.id
      WHERE ue.event_type = 'read'
        AND ue.created_at >= ?
      GROUP BY ue.target_id
      ORDER BY readCount DESC
      LIMIT 10
    `).all(start) as Array<{ title: string; source: string; readCount: number }>

    return {
      period: { start, end },
      summary: { totalReads, totalDays, avgPerDay, recommendHitRate },
      byDate,
      bySource,
      byHour,
      topArticles,
    }
  } finally {
    db.close()
  }
}

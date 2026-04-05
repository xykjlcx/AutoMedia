import { db } from '@/lib/db/index'

export interface CrossSourceAlert {
  entityId: string
  entityName: string
  entityType: string
  sources: string[] // 出现的信息源列表
  firstSeenDate: string
  daysSinceFirstSeen: number
  mentionCount: number
  spreadPath: string // 例如 "hackernews → 36kr → zhihu"
  articles: Array<{
    id: string
    title: string
    source: string
    url: string
  }>
}

// 检测跨源传播的实体，返回预警列表
export function detectCrossSourceAlerts(date: string): CrossSourceAlert[] {
  // 查询当天有文章关联的实体，以及它们的源分布
  const entitySources = db.$client.prepare(`
    SELECT
      te.id as entity_id,
      te.name as entity_name,
      te.type as entity_type,
      te.first_seen_date,
      te.mention_count,
      di.source,
      di.id as article_id,
      di.title as article_title,
      di.url as article_url
    FROM topic_entities te
    JOIN article_relations ar ON ar.entity_id = te.id
    JOIN digest_items di ON di.id = ar.digest_item_id
    WHERE di.digest_date = ?
    ORDER BY te.name, di.source
  `).all(date) as Array<{
    entity_id: string
    entity_name: string
    entity_type: string
    first_seen_date: string
    mention_count: number
    source: string
    article_id: string
    article_title: string
    article_url: string
  }>

  if (entitySources.length === 0) return []

  // 按实体分组
  const entityMap = new Map<string, {
    entityId: string
    entityName: string
    entityType: string
    firstSeenDate: string
    mentionCount: number
    sources: Set<string>
    articles: Array<{ id: string; title: string; source: string; url: string }>
  }>()

  for (const row of entitySources) {
    let entry = entityMap.get(row.entity_id)
    if (!entry) {
      entry = {
        entityId: row.entity_id,
        entityName: row.entity_name,
        entityType: row.entity_type,
        firstSeenDate: row.first_seen_date,
        mentionCount: row.mention_count,
        sources: new Set(),
        articles: [],
      }
      entityMap.set(row.entity_id, entry)
    }
    entry.sources.add(row.source)
    // 避免重复文章
    if (!entry.articles.find(a => a.id === row.article_id)) {
      entry.articles.push({
        id: row.article_id,
        title: row.article_title,
        source: row.source,
        url: row.article_url,
      })
    }
  }

  // 筛选跨 2+ 源的实体
  const alerts: CrossSourceAlert[] = []
  const dateObj = new Date(date)

  for (const entry of entityMap.values()) {
    if (entry.sources.size < 2) continue

    const sourcesArr = [...entry.sources]
    const firstSeenObj = new Date(entry.firstSeenDate)
    const daysSince = Math.max(0, Math.floor((dateObj.getTime() - firstSeenObj.getTime()) / (1000 * 60 * 60 * 24)))

    alerts.push({
      entityId: entry.entityId,
      entityName: entry.entityName,
      entityType: entry.entityType,
      sources: sourcesArr,
      firstSeenDate: entry.firstSeenDate,
      daysSinceFirstSeen: daysSince,
      mentionCount: entry.mentionCount,
      spreadPath: sourcesArr.join(' → '),
      articles: entry.articles,
    })
  }

  // 按源数量降序排列
  alerts.sort((a, b) => b.sources.length - a.sources.length)

  return alerts
}

// 获取最近 N 天的跨源预警
export function getRecentAlerts(days: number = 7): CrossSourceAlert[] {
  const today = new Date()
  const allAlerts: CrossSourceAlert[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const alerts = detectCrossSourceAlerts(dateStr)
    allAlerts.push(...alerts)
  }

  // 按实体去重，保留源数量最多的记录
  const seen = new Map<string, CrossSourceAlert>()
  for (const alert of allAlerts) {
    const existing = seen.get(alert.entityId)
    if (!existing || alert.sources.length > existing.sources.length) {
      seen.set(alert.entityId, alert)
    }
  }

  return [...seen.values()].sort((a, b) => b.sources.length - a.sources.length)
}

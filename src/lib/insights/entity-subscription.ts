import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'

export interface SubscriptionRow {
  id: string
  entityId: string
  entityName: string
  entityType: string
  createdAt: string
  lastNotifiedAt: string | null
  notifyCount: number
}

export function listSubscriptions(): SubscriptionRow[] {
  return db.$client.prepare(`
    SELECT
      es.id, es.entity_id as entityId, es.created_at as createdAt,
      es.last_notified_at as lastNotifiedAt, es.notify_count as notifyCount,
      te.name as entityName, te.type as entityType
    FROM entity_subscriptions es
    JOIN topic_entities te ON te.id = es.entity_id
    ORDER BY es.created_at DESC
  `).all() as SubscriptionRow[]
}

export function subscribe(entityId: string): string {
  const existing = db.$client.prepare(
    'SELECT id FROM entity_subscriptions WHERE entity_id = ?'
  ).get(entityId) as { id: string } | undefined

  if (existing) return existing.id

  const id = uuid()
  db.$client.prepare(`
    INSERT INTO entity_subscriptions (id, entity_id, created_at, notify_count)
    VALUES (?, ?, ?, 0)
  `).run(id, entityId, new Date().toISOString())
  return id
}

export function unsubscribe(id: string): void {
  db.$client.prepare('DELETE FROM entity_subscriptions WHERE id = ?').run(id)
}

export function isSubscribed(entityId: string): boolean {
  const row = db.$client.prepare(
    'SELECT 1 FROM entity_subscriptions WHERE entity_id = ?'
  ).get(entityId)
  return !!row
}

export interface SubscriptionMatch {
  subscriptionId: string
  entityId: string
  entityName: string
  entityType: string
  newArticles: Array<{ title: string; source: string }>
}

// 查找需要推送的订阅：当前批次实体中有订阅的 && (never notified OR 24h 之前才通知)
export function findSubscriptionsToNotify(
  currentDateEntities: string[],
  date: string
): SubscriptionMatch[] {
  if (currentDateEntities.length === 0) return []

  const placeholders = currentDateEntities.map(() => '?').join(',')
  const threshold = new Date(Date.now() - 24 * 3600000).toISOString()

  const rows = db.$client.prepare(`
    SELECT
      es.id as subscriptionId, es.entity_id as entityId,
      te.name as entityName, te.type as entityType
    FROM entity_subscriptions es
    JOIN topic_entities te ON te.id = es.entity_id
    WHERE es.entity_id IN (${placeholders})
      AND (es.last_notified_at IS NULL OR es.last_notified_at < ?)
  `).all(...currentDateEntities, threshold) as Array<{
    subscriptionId: string
    entityId: string
    entityName: string
    entityType: string
  }>

  // 为每个匹配的订阅查询当天相关的文章
  return rows.map(r => {
    const articles = db.$client.prepare(`
      SELECT DISTINCT di.title, di.source
      FROM article_relations ar
      JOIN digest_items di ON di.id = ar.digest_item_id
      WHERE ar.entity_id = ? AND di.digest_date = ?
      LIMIT 5
    `).all(r.entityId, date) as Array<{ title: string; source: string }>

    return { ...r, newArticles: articles }
  })
}

export function markNotified(subscriptionIds: string[]): void {
  if (subscriptionIds.length === 0) return
  const now = new Date().toISOString()
  const stmt = db.$client.prepare(`
    UPDATE entity_subscriptions
    SET last_notified_at = ?, notify_count = notify_count + 1
    WHERE id = ?
  `)
  const tx = db.$client.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(now, id)
  })
  tx(subscriptionIds)
}

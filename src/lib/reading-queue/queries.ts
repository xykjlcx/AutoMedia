import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'

export interface ReadingQueueEntry {
  id: string
  digestItemId: string
  addedAt: string
  expiresAt: string
  readAt: string | null
  // Join 过来的文章信息
  title: string
  source: string
  url: string
  oneLiner: string
  digestDate: string
  aiScore: number
}

const DEFAULT_EXPIRE_DAYS = 7

export function addToQueue(digestItemId: string): string {
  const now = new Date()
  const expires = new Date(now.getTime() + DEFAULT_EXPIRE_DAYS * 86400000)

  // upsert：已存在则返回旧 id
  const existing = db.$client.prepare(
    'SELECT id FROM reading_queue WHERE digest_item_id = ?'
  ).get(digestItemId) as { id: string } | undefined

  if (existing) return existing.id

  const id = uuid()
  db.$client.prepare(`
    INSERT INTO reading_queue (id, digest_item_id, added_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, digestItemId, now.toISOString(), expires.toISOString())

  return id
}

export function removeFromQueue(id: string): void {
  db.$client.prepare('DELETE FROM reading_queue WHERE id = ?').run(id)
}

export function markRead(id: string): void {
  db.$client.prepare(
    'UPDATE reading_queue SET read_at = ? WHERE id = ?'
  ).run(new Date().toISOString(), id)
}

export function cleanupExpired(): number {
  const result = db.$client.prepare(
    "DELETE FROM reading_queue WHERE expires_at < ? AND read_at IS NULL"
  ).run(new Date().toISOString())
  return result.changes
}

export function listQueue(): ReadingQueueEntry[] {
  cleanupExpired()
  return db.$client.prepare(`
    SELECT
      rq.id, rq.digest_item_id as digestItemId, rq.added_at as addedAt,
      rq.expires_at as expiresAt, rq.read_at as readAt,
      di.title, di.source, di.url, di.one_liner as oneLiner,
      di.digest_date as digestDate, di.ai_score as aiScore
    FROM reading_queue rq
    JOIN digest_items di ON di.id = rq.digest_item_id
    ORDER BY rq.added_at DESC
  `).all() as ReadingQueueEntry[]
}

export function getQueueByItemId(digestItemId: string): { id: string } | null {
  const row = db.$client.prepare(
    'SELECT id FROM reading_queue WHERE digest_item_id = ?'
  ).get(digestItemId) as { id: string } | undefined
  return row || null
}

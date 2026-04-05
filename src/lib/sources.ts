import { db } from './db/index'
import { sourceConfigs } from './db/schema'
import { asc } from 'drizzle-orm'

export interface SourceConfig {
  id: string
  name: string
  icon: string
  type: string
  rssPath: string
  rssUrl: string
  targetUrl: string
  enabled: boolean
  maxItems: number
}

export function getAllSources(): SourceConfig[] {
  const rows = db.select().from(sourceConfigs).orderBy(asc(sourceConfigs.sortOrder)).all()
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    type: r.type,
    rssPath: r.rssPath ?? '',
    rssUrl: r.rssUrl ?? '',
    targetUrl: r.targetUrl ?? '',
    enabled: r.enabled ?? true,
    maxItems: r.maxItems ?? 5,
  }))
}

export function getEnabledSources(): SourceConfig[] {
  return getAllSources().filter(s => s.enabled)
}

// 注：函数名保留 getPublicSources 以避免 call site 级联改动。
// 语义实为"所有有 collector 可以采集的源"（含 twitter-public / twitter-private）
export function getPublicSources(): SourceConfig[] {
  return getAllSources().filter(s =>
    s.enabled && (
      s.type === 'public' ||
      s.type === 'custom-rss' ||
      s.type === 'twitter-public' ||
      s.type === 'twitter-private'
    )
  )
}

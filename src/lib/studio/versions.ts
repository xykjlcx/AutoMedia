import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'

// 草稿版本快照：每个 draft 最多保留 20 个版本
const MAX_VERSIONS_PER_DRAFT = 20

export type VersionSource = 'ai_generate' | 'manual_save' | 'pre_regenerate'

export interface DraftVersion {
  id: string
  draftId: string
  title: string
  content: string
  platform: string
  aiPrompt: string
  source: VersionSource
  createdAt: string
}

export function snapshotDraft(draftId: string, source: VersionSource): string | null {
  // 读当前 draft
  const draft = db.$client.prepare(`
    SELECT id, title, content, platform, ai_prompt as aiPrompt
    FROM drafts WHERE id = ?
  `).get(draftId) as { id: string; title: string; content: string; platform: string; aiPrompt: string } | undefined

  if (!draft) return null
  // 空内容不存快照（没意义）
  if (!draft.content || draft.content.trim().length === 0) return null

  const id = uuid()
  db.$client.prepare(`
    INSERT INTO draft_versions (id, draft_id, title, content, platform, ai_prompt, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    draftId,
    draft.title || '',
    draft.content,
    draft.platform,
    draft.aiPrompt || '',
    source,
    new Date().toISOString()
  )

  // 保留策略：每个 draft 最多 20 个 version，超出删最旧的非 manual_save
  enforceRetention(draftId)
  return id
}

function enforceRetention(draftId: string) {
  const all = db.$client.prepare(`
    SELECT id, source, created_at FROM draft_versions
    WHERE draft_id = ? ORDER BY created_at DESC
  `).all(draftId) as Array<{ id: string; source: string; created_at: string }>

  if (all.length <= MAX_VERSIONS_PER_DRAFT) return

  const excess = all.length - MAX_VERSIONS_PER_DRAFT
  // 优先删最旧的非 manual_save
  const deletable = all
    .filter(v => v.source !== 'manual_save')
    .slice(-excess)

  const stmt = db.$client.prepare(`DELETE FROM draft_versions WHERE id = ?`)
  for (const v of deletable) stmt.run(v.id)
}

export function listVersions(draftId: string): DraftVersion[] {
  return db.$client.prepare(`
    SELECT id, draft_id as draftId, title, content, platform, ai_prompt as aiPrompt, source, created_at as createdAt
    FROM draft_versions
    WHERE draft_id = ?
    ORDER BY created_at DESC
  `).all(draftId) as DraftVersion[]
}

export function getVersion(versionId: string): DraftVersion | null {
  const row = db.$client.prepare(`
    SELECT id, draft_id as draftId, title, content, platform, ai_prompt as aiPrompt, source, created_at as createdAt
    FROM draft_versions WHERE id = ?
  `).get(versionId) as DraftVersion | undefined
  return row || null
}

export function deleteVersion(versionId: string): void {
  db.$client.prepare(`DELETE FROM draft_versions WHERE id = ?`).run(versionId)
}

export function restoreVersion(draftId: string, versionId: string): boolean {
  const version = getVersion(versionId)
  if (!version || version.draftId !== draftId) return false

  // 回滚前先 snapshot 当前内容为 manual_save（防止误操作）
  snapshotDraft(draftId, 'manual_save')

  // 应用 version 内容到当前 draft
  db.$client.prepare(`
    UPDATE drafts SET title = ?, content = ?, platform = ?, ai_prompt = ?, updated_at = ?
    WHERE id = ?
  `).run(
    version.title,
    version.content,
    version.platform,
    version.aiPrompt,
    new Date().toISOString(),
    draftId
  )
  return true
}

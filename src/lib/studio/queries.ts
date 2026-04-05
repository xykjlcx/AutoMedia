// ============================================================================
// 设计说明：单用户本地工具（Single-User Design）
// ----------------------------------------------------------------------------
// 本模块刻意不做所有权隔离 —— AutoMedia 是洋哥个人本地运行的工具，全库只有
// 一个"用户"。所以 drafts / draft_sources / share_cards 等表都没有 owner_id，
// 所有 API 路由也不做身份校验，这是明确的设计取舍而非遗漏。
//
// 如果未来要支持多用户部署，最小改动范围如下：
//   1. schema.ts：给 drafts / draft_sources / share_cards 加 owner_id / user_id 列
//   2. 所有 API 路由（src/app/api/studio/**）接入身份识别，把当前用户 id 注入 query
//   3. 本文件的读写函数全部增加 ownerId 参数，并在 WHERE / INSERT 时带上该条件
//   4. 补充迁移脚本给历史数据回填 owner_id
// ============================================================================

import { db } from '@/lib/db/index'
import { drafts, draftSources, digestItems } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

export interface CreateDraftInput {
  platform: 'xhs' | 'twitter' | 'article'
  title?: string
  content?: string
  sourceItemIds?: string[]
}

export interface UpdateDraftInput {
  title?: string
  content?: string
  platform?: string
  status?: string
  aiPrompt?: string
  aiOriginal?: string
}

export function createDraft(input: CreateDraftInput) {
  const id = uuid()
  const now = new Date().toISOString()

  db.$client.transaction(() => {
    db.insert(drafts).values({
      id,
      platform: input.platform,
      title: input.title || '',
      content: input.content || '',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }).run()

    if (input.sourceItemIds?.length) {
      for (let i = 0; i < input.sourceItemIds.length; i++) {
        db.insert(draftSources).values({
          id: uuid(),
          draftId: id,
          digestItemId: input.sourceItemIds[i],
          sortOrder: i,
          createdAt: now,
        }).run()
      }
    }
  })()

  return id
}

export function getDraft(id: string) {
  const draft = db.select().from(drafts).where(eq(drafts.id, id)).get()
  if (!draft) return null

  const sources = db.select({
    id: draftSources.id,
    digestItemId: draftSources.digestItemId,
    sortOrder: draftSources.sortOrder,
    title: digestItems.title,
    source: digestItems.source,
    oneLiner: digestItems.oneLiner,
    url: digestItems.url,
  })
    .from(draftSources)
    .leftJoin(digestItems, eq(draftSources.digestItemId, digestItems.id))
    .where(eq(draftSources.draftId, id))
    .all()

  return { ...draft, sources }
}

export function listDrafts() {
  return db.select().from(drafts).orderBy(desc(drafts.updatedAt)).all()
}

export function updateDraft(id: string, input: UpdateDraftInput) {
  const now = new Date().toISOString()
  db.update(drafts).set({
    ...input,
    updatedAt: now,
  }).where(eq(drafts.id, id)).run()
}

export function deleteDraft(id: string) {
  db.delete(drafts).where(eq(drafts.id, id)).run()
}

// 全量同步草稿素材：以 itemIds 为准，事务内先清后插
// 用于草稿已保存后用户仍在调整素材选择的场景
export function syncDraftSources(draftId: string, itemIds: string[]) {
  const now = new Date().toISOString()
  // 去重并保留顺序
  const seen = new Set<string>()
  const orderedIds: string[] = []
  for (const id of itemIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    orderedIds.push(id)
  }

  db.$client.transaction(() => {
    db.delete(draftSources).where(eq(draftSources.draftId, draftId)).run()
    for (let i = 0; i < orderedIds.length; i++) {
      db.insert(draftSources).values({
        id: uuid(),
        draftId,
        digestItemId: orderedIds[i],
        sortOrder: i,
        createdAt: now,
      }).run()
    }
  })()
}

export function addDraftSources(draftId: string, itemIds: string[]) {
  const now = new Date().toISOString()
  const existing = db.select({ digestItemId: draftSources.digestItemId })
    .from(draftSources).where(eq(draftSources.draftId, draftId)).all()
  const existingIds = new Set(existing.map(e => e.digestItemId))

  const maxOrder = existing.length
  let order = maxOrder
  for (const itemId of itemIds) {
    if (existingIds.has(itemId)) continue
    db.insert(draftSources).values({
      id: uuid(),
      draftId,
      digestItemId: itemId,
      sortOrder: order++,
      createdAt: now,
    }).run()
  }
}

# Phase 1: 内容创作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AutoMedia 新增内容工作台，支持从日报选文章、AI 生成小红书/Twitter/公众号内容、分享卡片渲染、HTML 导出。

**Architecture:** DDD 目录重组（digest/ + studio/ + ai/），现有代码迁移到 digest 域，新建 studio 域。全屏 Markdown 编辑器 + 可收起侧栏布局。satori 渲染分享卡片。

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Vercel AI SDK, @uiw/react-md-editor, satori, @resvg/resvg-js

**Spec:** `docs/superpowers/specs/2026-04-05-automedia-v2-design.md`

---

## File Structure

### New Files

```
src/lib/ai/batch.ts                          — 通用批处理工具函数
src/lib/digest/pipeline.ts                   — 采集管线（从 lib/pipeline.ts 迁移）
src/lib/digest/scoring.ts                    — 评分（从 lib/ai/scoring.ts 迁移）
src/lib/digest/clustering.ts                 — 聚类（从 lib/ai/clustering.ts 迁移）
src/lib/digest/summarize.ts                  — 摘要（从 lib/ai/summarize.ts 迁移）
src/lib/digest/trends.ts                     — 趋势（从 lib/ai/trends.ts 迁移）
src/lib/digest/preference.ts                 — 偏好（从 lib/ai/preference.ts 迁移）
src/lib/digest/collectors/rss.ts             — RSS 采集器（从 lib/collectors/ 迁移）
src/lib/digest/collectors/types.ts           — 采集器类型（从 lib/collectors/ 迁移）
src/lib/studio/generator.ts                  — 内容生成调度
src/lib/studio/platforms/xhs.ts              — 小红书生成
src/lib/studio/platforms/twitter.ts          — Twitter 生成
src/lib/studio/platforms/article.ts          — 公众号生成
src/lib/studio/card-renderer.ts              — 分享卡片渲染
src/lib/studio/exporter.ts                   — HTML/Markdown 导出
src/lib/studio/queries.ts                    — 草稿 CRUD
src/app/api/studio/drafts/route.ts           — 草稿列表 + 创建
src/app/api/studio/drafts/[id]/route.ts      — 草稿详情 + 更新 + 删除
src/app/api/studio/generate/route.ts         — AI 内容生成
src/app/api/studio/cards/route.ts            — 分享卡片生成
src/app/api/studio/export/route.ts           — HTML 导出
src/app/studio/page.tsx                      — 工作台页面
src/components/studio/studio-page.tsx        — 工作台主组件
src/components/studio/source-picker.tsx      — 素材选择器
src/components/studio/draft-editor.tsx       — Markdown 编辑器
src/components/studio/platform-selector.tsx  — 平台选择
src/components/studio/card-preview.tsx       — 卡片预览
src/components/studio/export-dialog.tsx      — 导出弹窗
src/lib/__tests__/batch.test.ts              — 批处理测试
src/lib/__tests__/generator.test.ts          — 生成器测试
src/lib/__tests__/card-renderer.test.ts      — 卡片渲染测试
```

### Modified Files

```
src/lib/db/schema.ts                         — 新增 4 张表
src/lib/db/index.ts                          — 新增索引
src/lib/scheduler.ts                         — 更新 import 路径
src/lib/pipeline-events.ts                   — 更新 import 路径
src/app/api/digest/trigger/route.ts          — 更新 import 路径
src/app/api/digest/stream/route.ts           — 更新 import（如需要）
src/app/api/settings/test-model/route.ts     — import 不变
src/app/api/digest/summary/route.ts          — import 不变
src/components/layout/navbar.tsx             — 新增 Studio 导航链接
src/components/digest/digest-page.tsx        — 新增多选模式 + 发送到工作台
src/components/digest/digest-card.tsx        — 新增勾选框
```

---

### Task 1: 新增数据库表

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 在 schema.ts 末尾新增 4 张表定义**

在 `src/lib/db/schema.ts` 文件末尾（`scheduleConfig` 定义之后）追加：

```typescript
// 内容草稿
export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  platform: text('platform').notNull(), // 'xhs' | 'twitter' | 'article'
  content: text('content').notNull().default(''),
  status: text('status').notNull().default('draft'), // 'draft' | 'final' | 'exported'
  aiPrompt: text('ai_prompt').default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// 草稿素材关联
export const draftSources = sqliteTable('draft_sources', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').notNull(),
})

// 分享卡片
export const shareCards = sqliteTable('share_cards', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').references(() => drafts.id),
  digestItemId: text('digest_item_id').references(() => digestItems.id),
  template: text('template').notNull().default('default'),
  copyText: text('copy_text').notNull().default(''),
  imagePath: text('image_path').default(''),
  createdAt: text('created_at').notNull(),
})

// 用户行为事件
export const userEvents = sqliteTable('user_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(), // 'read' | 'click' | 'favorite' | ...
  targetType: text('target_type').notNull(), // 'digest_item' | 'draft' | ...
  targetId: text('target_id').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
})
```

- [ ] **Step 2: 在 db/index.ts 新增索引**

在 `src/lib/db/index.ts` 的现有索引语句后追加：

```typescript
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_drafts_platform ON drafts(platform)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_draft_sources_draft ON draft_sources(draft_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_share_cards_draft ON share_cards(draft_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_events_target ON user_events(target_type, target_id)`)
```

- [ ] **Step 3: 验证 dev server 启动正常**

Run: `pnpm dev`（已在后台运行，重新检查无报错）

检查 data/automedia.db 中新表是否被创建：
Run: `sqlite3 data/automedia.db ".tables"`

Expected: 输出中包含 `drafts`, `draft_sources`, `share_cards`, `user_events`

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/index.ts
git commit -m "数据库：新增 drafts/draft_sources/share_cards/user_events 表"
```

---

### Task 2: 批处理工具函数

**Files:**
- Create: `src/lib/ai/batch.ts`
- Test: `src/lib/__tests__/batch.test.ts`

- [ ] **Step 1: 写测试**

创建 `src/lib/__tests__/batch.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { batchProcess } from '../ai/batch'

describe('batchProcess', () => {
  it('处理所有条目并返回结果', async () => {
    const items = [1, 2, 3, 4, 5]
    const result = await batchProcess({
      items,
      batchSize: 2,
      concurrency: 1,
      process: async (batch) => batch.map(n => n * 2),
    })
    expect(result.results).toEqual([2, 4, 6, 8, 10])
    expect(result.failedCount).toBe(0)
  })

  it('并发控制：concurrency=2 时两个批次同时执行', async () => {
    let maxConcurrent = 0
    let running = 0
    const items = [1, 2, 3, 4, 5, 6]

    await batchProcess({
      items,
      batchSize: 2,
      concurrency: 2,
      process: async (batch) => {
        running++
        maxConcurrent = Math.max(maxConcurrent, running)
        await new Promise(r => setTimeout(r, 50))
        running--
        return batch
      },
    })
    expect(maxConcurrent).toBe(2)
  })

  it('某批次失败时记录 failedCount 并继续处理', async () => {
    const items = [1, 2, 3, 4]
    const result = await batchProcess({
      items,
      batchSize: 2,
      concurrency: 1,
      process: async (batch) => {
        if (batch.includes(3)) throw new Error('test error')
        return batch.map(n => n * 10)
      },
    })
    expect(result.results).toEqual([10, 20])
    expect(result.failedCount).toBe(2)
  })

  it('调用 onProgress 回调', async () => {
    const progress: number[] = []
    await batchProcess({
      items: [1, 2, 3],
      batchSize: 1,
      concurrency: 1,
      process: async (batch) => batch,
      onProgress: (done) => { progress.push(done) },
    })
    expect(progress).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/lib/__tests__/batch.test.ts`

Expected: FAIL — `Cannot find module '../ai/batch'`

- [ ] **Step 3: 实现 batch.ts**

创建 `src/lib/ai/batch.ts`：

```typescript
export interface BatchOptions<T, R> {
  items: T[]
  batchSize: number
  concurrency: number
  process: (batch: T[]) => Promise<R[]>
  onProgress?: (done: number) => Promise<void> | void
}

export interface BatchResult<R> {
  results: R[]
  failedCount: number
}

// 通用批处理：切分批次 + 并发控制 + 错误隔离
export async function batchProcess<T, R>(opts: BatchOptions<T, R>): Promise<BatchResult<R>> {
  const { items, batchSize, concurrency, process, onProgress } = opts
  const results: R[] = []
  let failedCount = 0
  let doneCount = 0

  // 切分批次
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  // 并发控制
  let cursor = 0
  const runNext = async (): Promise<void> => {
    while (cursor < batches.length) {
      const idx = cursor++
      const batch = batches[idx]
      try {
        const batchResults = await process(batch)
        results.push(...batchResults)
      } catch (err) {
        console.error(`[batch] 批次 ${idx} 处理失败:`, err)
        failedCount += batch.length
      }
      doneCount += batch.length
      await onProgress?.(Math.min(doneCount, items.length))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, () => runNext())
  )

  return { results, failedCount }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/lib/__tests__/batch.test.ts`

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/batch.ts src/lib/__tests__/batch.test.ts
git commit -m "功能：通用批处理工具函数 ai/batch.ts"
```

---

### Task 3: DDD 目录重组 — 代码迁移

**Files:**
- Create: `src/lib/digest/` 目录及所有迁移文件
- Modify: `src/lib/scheduler.ts` — import 路径
- Modify: `src/lib/pipeline-events.ts` — import 路径
- Modify: `src/app/api/digest/trigger/route.ts` — import 路径
- Delete: 旧路径文件（迁移完成后）

迁移策略：先创建新文件 → 更新所有 import → 删除旧文件 → 验证构建。

- [ ] **Step 1: 创建 digest 目录结构**

```bash
mkdir -p src/lib/digest/collectors
```

- [ ] **Step 2: 迁移文件到 digest/**

```bash
cp src/lib/ai/scoring.ts src/lib/digest/scoring.ts
cp src/lib/ai/clustering.ts src/lib/digest/clustering.ts
cp src/lib/ai/summarize.ts src/lib/digest/summarize.ts
cp src/lib/ai/trends.ts src/lib/digest/trends.ts
cp src/lib/ai/preference.ts src/lib/digest/preference.ts
cp src/lib/pipeline.ts src/lib/digest/pipeline.ts
cp src/lib/collectors/rss.ts src/lib/digest/collectors/rss.ts
cp src/lib/collectors/types.ts src/lib/digest/collectors/types.ts
```

- [ ] **Step 3: 更新 digest/scoring.ts 的 import**

原始 import：
```typescript
import { getModels } from './client'
import { extractJson } from './utils'
import { getPreferenceProfile } from './preference'
import type { CollectedItem } from '../collectors/types'
```

修改为：
```typescript
import { getModels } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/utils'
import { getPreferenceProfile } from './preference'
import type { CollectedItem } from './collectors/types'
```

同时用 `batchProcess` 重构批处理逻辑。将 `scoreItems` 函数中手工的批处理/并发控制替换为调用 `batchProcess`：

```typescript
import { batchProcess } from '@/lib/ai/batch'
```

替换 `scoreItems` 中从 `// 切分批次` 到 `return { items: results, failedCount }` 的部分为：

```typescript
  const { results, failedCount } = await batchProcess({
    items,
    batchSize: 20,
    concurrency: 2,
    process: async (batch) => {
      const itemList = batch.map((item, idx) => (
        `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容摘要:${item.content.slice(0, 300)}`
      )).join('\n\n')

      const { text } = await generateText({
        model: getModels().fast,
        prompt: `你是一个资讯筛选 AI。请对以下资讯条目进行评分。

关注领域：
${INTEREST_DOMAINS.map(d => `- ${d}`).join('\n')}
${preferenceSection}
评分维度（每项 0-10 分）：
- relevance: 与关注领域的匹配度
- novelty: 是否有新信息、新观点
- impact: 对行业/技术的影响程度

请严格只返回 JSON 数组，不要有其他文字：
[{"index": 0, "relevance": 8, "novelty": 7, "impact": 6}, ...]

资讯列表：
${itemList}`,
      })

      const jsonStr = extractJson(text)
      if (!jsonStr) throw new Error('无法提取 JSON')

      const scores: Array<{ index: number; relevance: number; novelty: number; impact: number }> = JSON.parse(jsonStr)
      return scores.map(score => {
        const item = batch[score.index]
        if (!item) return null
        const aiScore = score.relevance * 0.4 + score.novelty * 0.3 + score.impact * 0.3
        return {
          ...item,
          aiScore: Math.round(aiScore * 10) / 10,
          scoreBreakdown: {
            relevance: score.relevance,
            novelty: score.novelty,
            impact: score.impact,
          },
        }
      }).filter((x): x is ScoredItem => x !== null)
    },
    onProgress,
  })

  return { items: results, failedCount }
```

- [ ] **Step 4: 更新 digest/clustering.ts 的 import**

```typescript
import { getModels } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/utils'
import type { ScoredItem } from './scoring'
```

- [ ] **Step 5: 更新 digest/summarize.ts 的 import 并用 batchProcess 重构**

import 修改：
```typescript
import { getModels } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/utils'
import { batchProcess } from '@/lib/ai/batch'
import type { ClusteredItem } from './clustering'
```

同样用 `batchProcess` 替换手工的批处理逻辑（类似 scoring 的重构方式）。

- [ ] **Step 6: 更新 digest/trends.ts 的 import**

```typescript
import { getModels } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/utils'
```

- [ ] **Step 7: 更新 digest/preference.ts 的 import**

```typescript
import { getModels } from '@/lib/ai/client'
```

- [ ] **Step 8: 更新 digest/pipeline.ts 的 import**

原始 import（现在是 `src/lib/digest/pipeline.ts`）：

```typescript
import { rssCollector } from './collectors/rss'
import { scoreItems } from './scoring'
import { clusterItems } from './clustering'
import { summarizeItems } from './summarize'
import { analyzeTrends } from './trends'
import { shouldUpdateProfile, updatePreferenceProfile } from './preference'
import type { CollectedItem } from './collectors/types'
import { pipelineEvents } from '@/lib/pipeline-events'
import { sendDigestNotification } from '@/lib/notify'
import { getPublicSources, getEnabledSources } from '@/lib/sources'
```

注意：`pipelineEvents`、`sendDigestNotification`、`getPublicSources` 保留在 `src/lib/` 根目录，用绝对路径引用。

- [ ] **Step 9: 更新外部消费者的 import 路径**

`src/lib/scheduler.ts` 第 5 行：
```typescript
// 旧：import { runDigestPipeline, isDigestRunning } from './pipeline'
import { runDigestPipeline, isDigestRunning } from './digest/pipeline'
```

`src/lib/pipeline-events.ts` 第 2 行：
```typescript
// 旧：import type { PipelineProgress } from './pipeline'
import type { PipelineProgress } from './digest/pipeline'
```

`src/app/api/digest/trigger/route.ts` 第 2 行：
```typescript
// 旧：import { runDigestPipeline, isDigestRunning } from '@/lib/pipeline'
import { runDigestPipeline, isDigestRunning } from '@/lib/digest/pipeline'
```

- [ ] **Step 10: 删除旧文件**

```bash
rm src/lib/ai/scoring.ts src/lib/ai/clustering.ts src/lib/ai/summarize.ts
rm src/lib/ai/trends.ts src/lib/ai/preference.ts
rm src/lib/pipeline.ts
rm -rf src/lib/collectors/
```

- [ ] **Step 11: 验证构建**

Run: `pnpm build`

Expected: 构建成功无报错。如果有 import 路径遗漏，根据报错信息修复。

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "重构：DDD 目录重组，digest 域代码迁移 + batch 重构 scoring/summarize"
```

---

### Task 4: Studio 后端 — 草稿 CRUD

**Files:**
- Create: `src/lib/studio/queries.ts`
- Create: `src/app/api/studio/drafts/route.ts`
- Create: `src/app/api/studio/drafts/[id]/route.ts`

- [ ] **Step 1: 创建 studio 目录**

```bash
mkdir -p src/lib/studio/platforms
mkdir -p src/app/api/studio/drafts/\[id\]
```

- [ ] **Step 2: 实现 queries.ts**

创建 `src/lib/studio/queries.ts`：

```typescript
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
```

- [ ] **Step 3: 实现草稿列表 + 创建 API**

创建 `src/app/api/studio/drafts/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { createDraft, listDrafts } from '@/lib/studio/queries'

export async function GET() {
  const items = listDrafts()
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { platform, title, content, sourceItemIds } = body

  if (!platform || !['xhs', 'twitter', 'article'].includes(platform)) {
    return NextResponse.json({ error: '无效的平台' }, { status: 400 })
  }

  const id = createDraft({ platform, title, content, sourceItemIds })
  return NextResponse.json({ id })
}
```

- [ ] **Step 4: 实现草稿详情 + 更新 + 删除 API**

创建 `src/app/api/studio/drafts/[id]/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { getDraft, updateDraft, deleteDraft } from '@/lib/studio/queries'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const draft = getDraft(id)
  if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
  return NextResponse.json(draft)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  updateDraft(id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteDraft(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: 验证 API 可用**

Run: `curl -s http://localhost:3000/api/studio/drafts | head`

Expected: `[]`（空数组）

Run: `curl -s -X POST http://localhost:3000/api/studio/drafts -H 'Content-Type: application/json' -d '{"platform":"xhs"}'`

Expected: `{"id":"<uuid>"}`

- [ ] **Step 6: Commit**

```bash
git add src/lib/studio/queries.ts src/app/api/studio/drafts/
git commit -m "功能：Studio 草稿 CRUD API"
```

---

### Task 5: Studio 后端 — 平台模板 + AI 内容生成

**Files:**
- Create: `src/lib/studio/platforms/xhs.ts`
- Create: `src/lib/studio/platforms/twitter.ts`
- Create: `src/lib/studio/platforms/article.ts`
- Create: `src/lib/studio/generator.ts`
- Create: `src/app/api/studio/generate/route.ts`

- [ ] **Step 1: 小红书平台模板**

创建 `src/lib/studio/platforms/xhs.ts`：

```typescript
import { z } from 'zod'

export const xhsSchema = z.object({
  title: z.string().describe('标题，带 emoji，吸引眼球'),
  body: z.string().describe('正文，Markdown 格式，分段短句，300-800 字'),
  tags: z.array(z.string()).describe('3-5 个话题标签'),
  cover_suggestion: z.string().describe('封面图建议文案'),
})

export type XhsOutput = z.infer<typeof xhsSchema>

export function buildXhsPrompt(sources: Array<{ title: string; oneLiner: string; summary?: string; source: string }>) {
  const sourceList = sources.map((s, i) =>
    `[${i + 1}] 来源:${s.source} | ${s.title}\n${s.oneLiner}${s.summary ? `\n${s.summary}` : ''}`
  ).join('\n\n')

  return `你是一个小红书内容创作者，面向关注 AI、跨境电商、技术变革的受众。

基于以下资讯素材，创作一篇小红书帖子：

${sourceList}

要求：
- 标题：带 emoji，吸引眼球，20 字以内
- 正文：分段短句，每段 2-3 行，总计 300-800 字
- 语气：专业但不枯燥，有观点有态度
- 标签：3-5 个相关话题 tag（不带 # 号）
- 封面建议：一句话描述适合的封面图风格`
}

export function formatXhsToMarkdown(output: XhsOutput): string {
  const tags = output.tags.map(t => `#${t}`).join(' ')
  return `# ${output.title}\n\n${output.body}\n\n---\n${tags}\n\n> 封面建议：${output.cover_suggestion}`
}
```

- [ ] **Step 2: Twitter 平台模板**

创建 `src/lib/studio/platforms/twitter.ts`：

```typescript
import { z } from 'zod'

export const twitterSchema = z.object({
  tweets: z.array(z.object({
    index: z.number(),
    content: z.string().describe('推文内容，≤280 字'),
  })),
})

export type TwitterOutput = z.infer<typeof twitterSchema>

export function buildTwitterPrompt(sources: Array<{ title: string; oneLiner: string; summary?: string; source: string }>) {
  const sourceList = sources.map((s, i) =>
    `[${i + 1}] 来源:${s.source} | ${s.title}\n${s.oneLiner}${s.summary ? `\n${s.summary}` : ''}`
  ).join('\n\n')

  return `你是一个 Twitter 内容创作者，面向关注 AI、跨境电商、技术变革的英文/中文受众。

基于以下资讯素材，创作一个 Twitter Thread：

${sourceList}

要求：
- 第 1 条（Hook）：抓注意力，引起好奇
- 中间条：每条一个要点，≤280 字
- 最后一条：总结 + CTA（关注/转发）
- 总计 3-10 条推文
- 语气：简洁有力，信息密度高`
}

export function formatTwitterToMarkdown(output: TwitterOutput): string {
  return output.tweets.map((t, i) =>
    `**[${i + 1}/${output.tweets.length}]** (${t.content.length} 字)\n\n${t.content}`
  ).join('\n\n---\n\n')
}
```

- [ ] **Step 3: 公众号平台模板**

创建 `src/lib/studio/platforms/article.ts`：

```typescript
import { z } from 'zod'

export const articleSchema = z.object({
  title: z.string().describe('文章标题，简洁有力'),
  abstract: z.string().describe('一句话摘要'),
  body: z.string().describe('正文，Markdown 格式，含小标题，1000-3000 字'),
  sections: z.array(z.string()).describe('小标题列表'),
})

export type ArticleOutput = z.infer<typeof articleSchema>

export function buildArticlePrompt(sources: Array<{ title: string; oneLiner: string; summary?: string; source: string }>) {
  const sourceList = sources.map((s, i) =>
    `[${i + 1}] 来源:${s.source} | ${s.title}\n${s.oneLiner}${s.summary ? `\n${s.summary}` : ''}`
  ).join('\n\n')

  return `你是一个公众号长文作者，面向关注 AI、跨境电商、技术变革的全栈开发者。

基于以下资讯素材，创作一篇深度分析文章：

${sourceList}

要求：
- 标题：简洁有力，不超过 25 字
- 摘要：一句话概括文章核心观点
- 正文：小标题分段，深度分析，1000-3000 字
- 每个段落要有观点，不只是复述资讯
- 结尾有总结和展望
- 输出 sections 列表方便生成目录`
}

export function formatArticleToMarkdown(output: ArticleOutput): string {
  return `# ${output.title}\n\n> ${output.abstract}\n\n${output.body}`
}
```

- [ ] **Step 4: 内容生成调度器**

创建 `src/lib/studio/generator.ts`：

```typescript
import { generateObject } from 'ai'
import { getModels } from '@/lib/ai/client'
import { getDraft, updateDraft } from './queries'
import { xhsSchema, buildXhsPrompt, formatXhsToMarkdown } from './platforms/xhs'
import { twitterSchema, buildTwitterPrompt, formatTwitterToMarkdown } from './platforms/twitter'
import { articleSchema, buildArticlePrompt, formatArticleToMarkdown } from './platforms/article'

const platformConfigs = {
  xhs: { schema: xhsSchema, buildPrompt: buildXhsPrompt, formatToMarkdown: formatXhsToMarkdown },
  twitter: { schema: twitterSchema, buildPrompt: buildTwitterPrompt, formatToMarkdown: formatTwitterToMarkdown },
  article: { schema: articleSchema, buildPrompt: buildArticlePrompt, formatToMarkdown: formatArticleToMarkdown },
} as const

export async function generateContent(draftId: string) {
  const draft = getDraft(draftId)
  if (!draft) throw new Error('草稿不存在')

  const platform = draft.platform as keyof typeof platformConfigs
  const config = platformConfigs[platform]
  if (!config) throw new Error(`不支持的平台: ${platform}`)

  // 收集素材
  const sources = draft.sources.map(s => ({
    title: s.title || '',
    oneLiner: s.oneLiner || '',
    source: s.source || '',
  }))

  if (sources.length === 0) throw new Error('没有素材，请先添加文章')

  // 组装 prompt
  const prompt = config.buildPrompt(sources)

  // 调用 AI
  const { object } = await generateObject({
    model: getModels().quality,
    schema: config.schema,
    prompt,
  })

  // 格式化为 Markdown
  const markdown = config.formatToMarkdown(object as never)

  // 更新草稿
  updateDraft(draftId, {
    content: markdown,
    title: (object as { title?: string }).title || draft.title,
    aiPrompt: prompt,
  })

  return { content: markdown, raw: object }
}
```

- [ ] **Step 5: 生成 API 路由**

创建 `src/app/api/studio/generate/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { generateContent } from '@/lib/studio/generator'

export async function POST(req: Request) {
  const { draftId } = await req.json()

  if (!draftId) {
    return NextResponse.json({ error: '缺少 draftId' }, { status: 400 })
  }

  try {
    const result = await generateContent(draftId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/studio/platforms/ src/lib/studio/generator.ts src/app/api/studio/generate/
git commit -m "功能：AI 内容生成（小红书/Twitter/公众号三平台模板）"
```

---

### Task 6: Studio 后端 — 分享卡片渲染

**Files:**
- Create: `src/lib/studio/card-renderer.ts`
- Create: `src/app/api/studio/cards/route.ts`

- [ ] **Step 1: 安装依赖**

```bash
pnpm add satori @resvg/resvg-js
```

- [ ] **Step 2: 实现卡片渲染器**

创建 `src/lib/studio/card-renderer.ts`：

```typescript
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import type { ReactNode } from 'react'

const CARDS_DIR = join(process.cwd(), 'data', 'cards')

// 确保卡片目录存在
if (!existsSync(CARDS_DIR)) {
  mkdirSync(CARDS_DIR, { recursive: true })
}

// 加载字体（使用系统字体作为 fallback）
function loadFont(): ArrayBuffer {
  // 优先使用项目内的字体文件
  const fontPath = join(process.cwd(), 'public', 'fonts', 'NotoSansSC-Regular.ttf')
  if (existsSync(fontPath)) {
    return readFileSync(fontPath).buffer as ArrayBuffer
  }
  // fallback：使用系统中文字体
  const systemFonts = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
  ]
  for (const f of systemFonts) {
    if (existsSync(f)) return readFileSync(f).buffer as ArrayBuffer
  }
  throw new Error('未找到可用的中文字体，请将 NotoSansSC-Regular.ttf 放到 public/fonts/')
}

export interface CardInput {
  title: string
  summary: string
  source?: string
  date?: string
  brandName?: string
}

// CardRenderer 接口 — 预留 AI 生图扩展口
export interface CardRenderer {
  render(input: CardInput): Promise<string> // 返回图片路径
}

// 默认 satori 渲染实现
export const satoriRenderer: CardRenderer = {
  async render(input: CardInput): Promise<string> {
    const { title, summary, source, date, brandName = 'AutoMedia' } = input
    const font = loadFont()

    // 卡片 JSX（satori 要求 React.createElement 风格）
    const element = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          padding: '48px',
          fontFamily: 'Noto Sans SC',
          color: '#fff',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { color: '#e94560', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' },
              children: `${brandName} · 每日精选`,
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', lineHeight: 1.4 },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: '16px', color: '#aaa', lineHeight: 1.8, flex: 1 },
              children: summary.slice(0, 200) + (summary.length > 200 ? '...' : ''),
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#555', marginTop: '24px' },
              children: [
                { type: 'span', props: { children: date || new Date().toISOString().slice(0, 10) } },
                { type: 'span', props: { children: source || brandName } },
              ],
            },
          },
        ],
      },
    } as unknown as ReactNode

    const svg = await satori(element, {
      width: 800,
      height: 450,
      fonts: [{
        name: 'Noto Sans SC',
        data: font,
        weight: 400,
        style: 'normal',
      }],
    })

    const resvg = new Resvg(svg)
    const pngBuffer = resvg.render().asPng()

    const filename = `${uuid()}.png`
    const filepath = join(CARDS_DIR, filename)
    writeFileSync(filepath, pngBuffer)

    return filepath
  },
}
```

- [ ] **Step 3: 实现卡片 API**

创建 `src/app/api/studio/cards/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from '@/lib/ai/client'
import { satoriRenderer } from '@/lib/studio/card-renderer'
import { getDraft } from '@/lib/studio/queries'
import { db } from '@/lib/db/index'
import { shareCards, digestItems } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { readFileSync } from 'fs'

const cardCopySchema = z.object({
  title: z.string().describe('卡片标题，简洁有力，15 字以内'),
  summary: z.string().describe('卡片摘要，50-100 字，突出核心要点'),
})

export async function POST(req: Request) {
  const { draftId, digestItemId } = await req.json()

  if (!draftId && !digestItemId) {
    return NextResponse.json({ error: '需要 draftId 或 digestItemId' }, { status: 400 })
  }

  try {
    let title: string
    let content: string
    let source: string | undefined

    if (draftId) {
      // 从草稿生成
      const draft = getDraft(draftId)
      if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
      title = draft.title
      content = draft.content
    } else {
      // 从单篇文章生成
      const item = db.select().from(digestItems).where(eq(digestItems.id, digestItemId)).get()
      if (!item) return NextResponse.json({ error: '文章不存在' }, { status: 404 })
      title = item.title
      content = `${item.oneLiner}\n${item.summary}`
      source = item.source
    }

    // AI 生成卡片文案
    const { object: copy } = await generateObject({
      model: getModels().fast,
      schema: cardCopySchema,
      prompt: `为以下内容生成分享卡片文案：\n\n标题：${title}\n内容：${content}\n\n要求简洁有力，适合朋友圈/社群传播。`,
    })

    // 渲染卡片
    const imagePath = await satoriRenderer.render({
      title: copy.title,
      summary: copy.summary,
      source,
      date: new Date().toISOString().slice(0, 10),
    })

    // 存储记录
    const cardId = uuid()
    db.insert(shareCards).values({
      id: cardId,
      draftId: draftId || null,
      digestItemId: digestItemId || null,
      template: 'default',
      copyText: `${copy.title}\n${copy.summary}`,
      imagePath,
      createdAt: new Date().toISOString(),
    }).run()

    // 返回图片的 base64
    const imageBuffer = readFileSync(imagePath)
    const base64 = imageBuffer.toString('base64')

    return NextResponse.json({
      id: cardId,
      copy,
      image: `data:image/png;base64,${base64}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/studio/card-renderer.ts src/app/api/studio/cards/
git commit -m "功能：分享卡片渲染（satori + AI 文案生成）"
```

---

### Task 7: Studio 后端 — HTML 导出

**Files:**
- Create: `src/lib/studio/exporter.ts`
- Create: `src/app/api/studio/export/route.ts`

- [ ] **Step 1: 实现导出器**

创建 `src/lib/studio/exporter.ts`：

```typescript
import { getDraft } from './queries'

// 简单的 Markdown → HTML 转换（标题、段落、粗体、链接）
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match
      return match
    })
    .replace(/^(?!<)(.+)/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
}

export function exportToHtml(draftId: string): string {
  const draft = getDraft(draftId)
  if (!draft) throw new Error('草稿不存在')

  const bodyHtml = markdownToHtml(draft.content)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${draft.title || 'AutoMedia Export'}</title>
  <style>
    body { max-width: 680px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, sans-serif; line-height: 1.8; color: #333; }
    h1 { font-size: 1.8em; margin-bottom: 0.5em; }
    h2 { font-size: 1.4em; margin-top: 1.5em; }
    h3 { font-size: 1.2em; margin-top: 1.2em; }
    blockquote { border-left: 3px solid #e94560; padding-left: 16px; color: #666; margin: 1em 0; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    a { color: #e94560; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #999; font-size: 0.9em; margin-bottom: 2em; }
  </style>
</head>
<body>
  <div class="meta">
    <span>平台: ${draft.platform}</span> · <span>${draft.createdAt.slice(0, 10)}</span> · <span>Generated by AutoMedia</span>
  </div>
  ${bodyHtml}
</body>
</html>`
}

export function exportToMarkdown(draftId: string): string {
  const draft = getDraft(draftId)
  if (!draft) throw new Error('草稿不存在')
  return draft.content
}
```

- [ ] **Step 2: 实现导出 API**

创建 `src/app/api/studio/export/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { exportToHtml, exportToMarkdown } from '@/lib/studio/exporter'

export async function POST(req: Request) {
  const { draftId, format = 'html' } = await req.json()

  if (!draftId) {
    return NextResponse.json({ error: '缺少 draftId' }, { status: 400 })
  }

  try {
    if (format === 'markdown') {
      const content = exportToMarkdown(draftId)
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="export.md"`,
        },
      })
    }

    const html = exportToHtml(draftId)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="export.html"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/studio/exporter.ts src/app/api/studio/export/
git commit -m "功能：HTML/Markdown 导出"
```

---

### Task 8: 导航栏 + Studio 页面 Shell

**Files:**
- Modify: `src/components/layout/navbar.tsx`
- Create: `src/app/studio/page.tsx`
- Create: `src/components/studio/studio-page.tsx`

- [ ] **Step 1: 在导航栏新增 Studio 链接**

修改 `src/components/layout/navbar.tsx`，在 import 中添加 `PenLine`，在 `navLinks` 数组中的 `search` 和 `settings` 之间插入：

```typescript
{ href: "/studio", label: "Studio", icon: PenLine },
```

import 行修改为：
```typescript
import { Newspaper, Clock, Star, BarChart3, Search, PenLine, Settings } from "lucide-react"
```

- [ ] **Step 2: 创建 Studio 页面入口**

创建 `src/app/studio/page.tsx`：

```typescript
import { Suspense } from 'react'
import { StudioPage } from '@/components/studio/studio-page'
import { Skeleton } from '@/components/ui/skeleton'

export default function Studio() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full mt-4 rounded-lg" />
      </div>
    }>
      <StudioPage />
    </Suspense>
  )
}
```

- [ ] **Step 3: 创建工作台主组件（Shell）**

创建 `src/components/studio/studio-page.tsx`：

```typescript
"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SourcePicker } from './source-picker'
import { DraftEditor } from './draft-editor'
import { PlatformSelector } from './platform-selector'
import { CardPreview } from './card-preview'
import { ExportDialog } from './export-dialog'
import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Loader2 } from 'lucide-react'

export type Platform = 'xhs' | 'twitter' | 'article'

export interface DraftState {
  id: string | null
  platform: Platform
  title: string
  content: string
  sourceIds: string[]
}

export function StudioPage() {
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<DraftState>({
    id: null,
    platform: 'xhs',
    title: '',
    content: '',
    sourceIds: [],
  })
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showCardPreview, setShowCardPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // 从 URL 参数初始化（日报页跳转过来时带 items 参数）
  useEffect(() => {
    const itemIds = searchParams.get('items')
    if (itemIds) {
      const ids = itemIds.split(',').filter(Boolean)
      setDraft(prev => ({ ...prev, sourceIds: ids }))
      setLeftOpen(true) // 展开素材面板显示选中的文章
    }
  }, [searchParams])

  // 创建/更新草稿
  const saveDraft = async () => {
    if (draft.id) {
      await fetch(`/api/studio/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.title, content: draft.content, platform: draft.platform }),
      })
    } else {
      const res = await fetch('/api/studio/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: draft.platform, title: draft.title, content: draft.content, sourceItemIds: draft.sourceIds }),
      })
      const { id } = await res.json()
      setDraft(prev => ({ ...prev, id }))
      return id
    }
    return draft.id
  }

  // AI 生成
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const draftId = await saveDraft()
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      })
      const { content } = await res.json()
      if (content) {
        setDraft(prev => ({ ...prev, content }))
      }
    } finally {
      setGenerating(false)
    }
  }

  // 复制到剪贴板
  const handleCopy = () => {
    navigator.clipboard.writeText(draft.content)
  }

  return (
    <div className="mx-auto max-w-[1400px] h-[calc(100vh-3.5rem)] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <button onClick={() => setLeftOpen(!leftOpen)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="素材面板">
            {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
          <PlatformSelector value={draft.platform} onChange={(p) => setDraft(prev => ({ ...prev, platform: p }))} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating || draft.sourceIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : '✨'}
            <span>{generating ? '生成中...' : '生成'}</span>
          </button>
          <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors" title="复制 Markdown">📋</button>
          <button onClick={async () => { const id = await saveDraft(); if (id) setShowCardPreview(true) }} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors" title="生成卡片">🖼</button>
          <button onClick={async () => { const id = await saveDraft(); if (id) setShowExport(true) }} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors" title="导出">📤</button>
          <button onClick={() => setRightOpen(!rightOpen)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="预览面板">
            {rightOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
        </div>
      </div>

      {/* 主体三栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：素材面板 */}
        {leftOpen && (
          <div className="w-72 border-r border-border/60 overflow-y-auto shrink-0">
            <SourcePicker
              selectedIds={draft.sourceIds}
              onSelectionChange={(ids) => setDraft(prev => ({ ...prev, sourceIds: ids }))}
            />
          </div>
        )}

        {/* 中间：编辑器 */}
        <div className="flex-1 overflow-hidden">
          <DraftEditor
            content={draft.content}
            onChange={(content) => setDraft(prev => ({ ...prev, content }))}
          />
        </div>

        {/* 右侧：预览面板 */}
        {rightOpen && (
          <div className="w-80 border-l border-border/60 overflow-y-auto shrink-0 p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">预览</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: simpleMarkdownRender(draft.content) }} />
            </div>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {showCardPreview && draft.id && (
        <CardPreview draftId={draft.id} onClose={() => setShowCardPreview(false)} />
      )}
      {showExport && draft.id && (
        <ExportDialog draftId={draft.id} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}

// 简单的 Markdown 渲染（预览用，不需要完整解析）
function simpleMarkdownRender(md: string): string {
  if (!md) return '<p class="text-muted-foreground">暂无内容，点击「生成」开始创作</p>'
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '<br><br>')
}
```

- [ ] **Step 4: 验证页面可访问**

浏览器打开 `http://localhost:3000/studio`，确认页面加载无报错，导航栏显示 Studio 链接。

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/navbar.tsx src/app/studio/ src/components/studio/studio-page.tsx
git commit -m "功能：Studio 页面 Shell + 导航链接"
```

---

### Task 9: Studio 前端 — 子组件

**Files:**
- Create: `src/components/studio/source-picker.tsx`
- Create: `src/components/studio/draft-editor.tsx`
- Create: `src/components/studio/platform-selector.tsx`
- Create: `src/components/studio/card-preview.tsx`
- Create: `src/components/studio/export-dialog.tsx`

- [ ] **Step 1: 安装 Markdown 编辑器**

```bash
pnpm add @uiw/react-md-editor
```

- [ ] **Step 2: 素材选择器**

创建 `src/components/studio/source-picker.tsx`：

```typescript
"use client"

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SOURCE_META } from '@/lib/constants'

interface DigestItemBrief {
  id: string
  title: string
  source: string
  oneLiner: string
}

interface SourcePickerProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export function SourcePicker({ selectedIds, onSelectionChange }: SourcePickerProps) {
  const [tab, setTab] = useState<'digest' | 'favorites'>('digest')
  const [items, setItems] = useState<DigestItemBrief[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      try {
        if (tab === 'digest') {
          const date = new Date().toISOString().slice(0, 10)
          const res = await fetch(`/api/digest/${date}`)
          const data = await res.json()
          const all = Object.values(data.groups || {}).flat() as DigestItemBrief[]
          setItems(all)
        } else {
          const res = await fetch('/api/favorites')
          const data = await res.json()
          setItems(data.map((f: { digestItem: DigestItemBrief }) => f.digestItem).filter(Boolean))
        }
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    fetchItems()
  }, [tab])

  const toggle = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    )
  }

  return (
    <div className="p-3">
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setTab('digest')}
          className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', tab === 'digest' ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted')}
        >
          今日日报
        </button>
        <button
          onClick={() => setTab('favorites')}
          className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', tab === 'favorites' ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted')}
        >
          收藏
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">加载中...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无内容</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const selected = selectedIds.includes(item.id)
            const meta = SOURCE_META[item.source]
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={cn(
                  'w-full text-left p-2 rounded-md text-xs transition-colors border',
                  selected ? 'border-[var(--color-warm-accent)]/40 bg-[var(--color-warm-accent)]/5' : 'border-transparent hover:bg-muted'
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn('size-4 rounded border flex items-center justify-center shrink-0 mt-0.5', selected ? 'bg-[var(--color-warm-accent)] border-[var(--color-warm-accent)]' : 'border-border')}>
                    {selected && <Check className="size-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {meta && <span>{meta.icon}</span>}
                      <span className="text-muted-foreground">{meta?.name}</span>
                    </div>
                    <p className="font-medium text-foreground line-clamp-2">{item.title}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Markdown 编辑器**

创建 `src/components/studio/draft-editor.tsx`：

```typescript
"use client"

import dynamic from 'next/dynamic'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface DraftEditorProps {
  content: string
  onChange: (content: string) => void
}

export function DraftEditor({ content, onChange }: DraftEditorProps) {
  return (
    <div className="h-full" data-color-mode="dark">
      <MDEditor
        value={content}
        onChange={(val) => onChange(val || '')}
        height="100%"
        preview="edit"
        visibleDragbar={false}
        hideToolbar={false}
      />
    </div>
  )
}
```

- [ ] **Step 4: 平台选择器**

创建 `src/components/studio/platform-selector.tsx`：

```typescript
"use client"

import { cn } from '@/lib/utils'
import type { Platform } from './studio-page'

const platforms: Array<{ key: Platform; label: string; icon: string }> = [
  { key: 'xhs', label: '小红书', icon: '📕' },
  { key: 'twitter', label: 'Twitter', icon: '🐦' },
  { key: 'article', label: '公众号', icon: '📖' },
]

interface PlatformSelectorProps {
  value: Platform
  onChange: (platform: Platform) => void
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <div className="flex gap-1">
      {platforms.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            value === p.key
              ? 'bg-[var(--color-warm-accent)] text-white'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: 卡片预览弹窗**

创建 `src/components/studio/card-preview.tsx`：

```typescript
"use client"

import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'

interface CardPreviewProps {
  draftId: string
  onClose: () => void
}

export function CardPreview({ draftId, onClose }: CardPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [imageData, setImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImageData(data.image)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!imageData) return
    const link = document.createElement('a')
    link.href = imageData
    link.download = `share-card-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">分享卡片</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="size-4" /></button>
        </div>

        {!imageData && !loading && (
          <div className="text-center py-8">
            <button onClick={generate} className="px-4 py-2 rounded-lg bg-[var(--color-warm-accent)] text-white font-medium hover:opacity-90 transition-opacity">
              生成分享卡片
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">AI 生成文案 + 渲染中...</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500 text-center py-4">{error}</p>}

        {imageData && (
          <div>
            <img src={imageData} alt="Share Card" className="w-full rounded-lg mb-4" />
            <button onClick={download} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-medium">
              <Download className="size-4" />
              下载图片
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 导出弹窗**

创建 `src/components/studio/export-dialog.tsx`：

```typescript
"use client"

import { X, FileText, Code } from 'lucide-react'

interface ExportDialogProps {
  draftId: string
  onClose: () => void
}

export function ExportDialog({ draftId, onClose }: ExportDialogProps) {
  const handleExport = async (format: 'html' | 'markdown') => {
    const res = await fetch('/api/studio/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, format }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = format === 'html' ? 'export.html' : 'export.md'
    link.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">导出</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => handleExport('html')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <Code className="size-5 text-[var(--color-warm-accent)]" />
            <div>
              <p className="text-sm font-medium">HTML</p>
              <p className="text-xs text-muted-foreground">带样式的网页文件</p>
            </div>
          </button>
          <button
            onClick={() => handleExport('markdown')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <FileText className="size-5 text-[var(--color-warm-accent)]" />
            <div>
              <p className="text-sm font-medium">Markdown</p>
              <p className="text-xs text-muted-foreground">纯文本格式，兼容各平台</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 验证工作台完整功能**

浏览器打开 `http://localhost:3000/studio`，验证：
1. 左侧素材面板可展开/收起
2. 平台切换正常
3. Markdown 编辑器可输入
4. 右侧预览面板可展开/收起

- [ ] **Step 8: Commit**

```bash
git add src/components/studio/
git commit -m "功能：Studio 前端子组件（素材选择、编辑器、平台选择、卡片预览、导出）"
```

---

### Task 10: 日报页多选 + 发送到工作台

**Files:**
- Modify: `src/components/digest/digest-page.tsx`
- Modify: `src/components/digest/digest-card.tsx`

- [ ] **Step 1: 在 DigestCard 中添加勾选框**

修改 `src/components/digest/digest-card.tsx`：

在 `DigestCardProps` 中添加：
```typescript
interface DigestCardProps {
  item: DigestItem
  index?: number
  selectable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}
```

在组件参数中解构新 props：
```typescript
export function DigestCard({ item, index = 0, selectable, selected, onSelect }: DigestCardProps) {
```

在 `<article>` 标签内最前面（`<div className="p-4">` 之前）添加勾选框：

```typescript
{selectable && (
  <button
    onClick={(e) => { e.stopPropagation(); onSelect?.(item.id) }}
    className="absolute top-3 right-3 z-10"
  >
    <div className={cn(
      'size-5 rounded border-2 flex items-center justify-center transition-colors',
      selected ? 'bg-[var(--color-warm-accent)] border-[var(--color-warm-accent)]' : 'border-border hover:border-[var(--color-warm-accent)]/50'
    )}>
      {selected && <Check className="size-3.5 text-white" />}
    </div>
  </button>
)}
```

在 import 中添加 `Check`：
```typescript
import { ExternalLink, ChevronDown, Users, Check } from "lucide-react"
```

- [ ] **Step 2: 在 DigestPage 中添加多选模式**

修改 `src/components/digest/digest-page.tsx`：

新增 state：
```typescript
const [selectMode, setSelectMode] = useState(false)
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
```

新增 import：
```typescript
import { useRouter } from 'next/navigation'
```

在组件顶部：
```typescript
const router = useRouter()
```

添加选择切换函数：
```typescript
const toggleSelect = (id: string) => {
  setSelectedItems(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

const sendToStudio = () => {
  const ids = Array.from(selectedItems).join(',')
  router.push(`/studio?items=${ids}`)
}
```

修改 `DigestCard` 的渲染，传入选择 props：
```typescript
<DigestCard
  key={item.id}
  item={item}
  index={i}
  selectable={selectMode}
  selected={selectedItems.has(item.id)}
  onSelect={toggleSelect}
/>
```

在 tab 控制栏区域添加「选择模式」按钮和底部操作栏。

在 tab 区域后添加按钮：
```typescript
<button
  onClick={() => { setSelectMode(!selectMode); setSelectedItems(new Set()) }}
  className={cn(
    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
    selectMode ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted'
  )}
>
  {selectMode ? '取消选择' : '选择文章'}
</button>
```

在组件最外层 `</div>` 之前添加底部浮动操作栏：
```typescript
{selectMode && selectedItems.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg">
    <span className="text-sm text-muted-foreground">已选 {selectedItems.size} 篇</span>
    <button
      onClick={sendToStudio}
      className="px-4 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      发送到 Studio
    </button>
  </div>
)}
```

- [ ] **Step 3: 验证多选 + 跳转**

浏览器打开 `http://localhost:3000`，点击「选择文章」→ 勾选几篇 → 点「发送到 Studio」→ 确认跳转到 `/studio?items=id1,id2,...` 且素材面板自动展开显示选中文章。

- [ ] **Step 4: Commit**

```bash
git add src/components/digest/digest-card.tsx src/components/digest/digest-page.tsx
git commit -m "功能：日报页多选文章 + 发送到 Studio"
```

---

### Task 11: 用户行为追踪 Hook

**Files:**
- Create: `src/lib/analytics/track.ts`
- Create: `src/app/api/events/route.ts`

- [ ] **Step 1: 实现追踪函数**

```bash
mkdir -p src/lib/analytics
```

创建 `src/lib/analytics/track.ts`：

```typescript
import { db } from '@/lib/db/index'
import { userEvents } from '@/lib/db/schema'
import { v4 as uuid } from 'uuid'

export function trackEvent(
  eventType: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  db.insert(userEvents).values({
    id: uuid(),
    eventType,
    targetType,
    targetId,
    metadata: metadata || null,
    createdAt: new Date().toISOString(),
  }).run()
}
```

- [ ] **Step 2: 实现事件上报 API**

创建 `src/app/api/events/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { trackEvent } from '@/lib/analytics/track'

export async function POST(req: Request) {
  const { eventType, targetType, targetId, metadata } = await req.json()

  if (!eventType || !targetType || !targetId) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
  }

  trackEvent(eventType, targetType, targetId, metadata)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics/ src/app/api/events/
git commit -m "功能：用户行为追踪（user_events 写入 + API）"
```

---

### Task 12: 集成验证 + 清理

- [ ] **Step 1: 完整构建验证**

Run: `pnpm build`

Expected: 构建成功，无报错。

- [ ] **Step 2: 运行所有测试**

Run: `pnpm test`

Expected: 所有测试通过。

- [ ] **Step 3: 添加 .superpowers/ 到 .gitignore**

在 `.gitignore` 中添加：
```
.superpowers/
```

- [ ] **Step 4: 添加 data/cards/ 到 .gitignore**

在 `.gitignore` 中添加：
```
data/cards/
```

- [ ] **Step 5: 最终 Commit**

```bash
git add .gitignore
git commit -m "Phase 1 完成：内容工作台 + AI 生成 + 分享卡片 + 导出"
```

# Spec 1 实施计划：读-洞察体验升级

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 交付 B1 今日三件事 TL;DR + B2 稍后读队列 + C2 实体订阅 + C3 每周洞察摘要四项功能。

**Architecture:** 4 张独立新表 + 4 个 lib 模块 + 10+ API 路由 + 6 个新前端组件。数据流沿用现有 Pipeline 模式（Stage 末尾合成）。

**Tech Stack:** Next.js 16 / Drizzle + better-sqlite3 / Vercel AI SDK (`generateObject` + Zod) / shadcn/ui。

---

## 文件结构

### 新增
```
src/lib/digest/tldr.ts                          - B1 TL;DR 生成
src/lib/digest/weekly-insight.ts                - C3 周洞察生成
src/lib/reading-queue/queries.ts                - B2 稍后读 CRUD
src/lib/insights/entity-subscription.ts         - C2 订阅检测
src/app/api/digest/tldr/route.ts                - TL;DR GET/POST
src/app/api/reading-queue/route.ts              - 列表 + 加入
src/app/api/reading-queue/[id]/route.ts         - 标记已读 + 删除
src/app/api/entity-subscriptions/route.ts       - 列表 + 订阅
src/app/api/entity-subscriptions/[id]/route.ts  - 取消
src/app/api/insights/weekly/route.ts            - GET/POST
src/components/digest/tldr-card.tsx             - 首页 TL;DR 卡片
src/components/digest/reading-queue-button.tsx  - 卡片按钮
src/components/favorites/favorites-tabs.tsx     - 双 Tab 容器
src/components/favorites/reading-queue-list.tsx - 稍后读列表
src/components/insights/weekly-insight-card.tsx - 周洞察卡片
src/components/insights/entity-subscribe-button.tsx - 订阅按钮
```

### 修改
```
src/lib/db/schema.ts                   - 4 张新表
src/lib/db/index.ts                    - 4 张新表 DDL
src/lib/digest/pipeline.ts             - Stage 4 TL;DR + 订阅推送
src/lib/notify.ts                      - sendEntityAlerts
src/lib/scheduler.ts                   - weekly insight cron
src/components/digest/digest-page.tsx  - 嵌入 TldrCard
src/components/digest/digest-card.tsx  - 加稍后读按钮
src/app/favorites/page.tsx             - Tabs 布局
src/components/insights/entity-graph.tsx - 订阅按钮嵌入
src/app/insights/page.tsx              - 顶部 WeeklyInsightCard
```

---

## Task 1: 数据库 Schema + Bootstrap DDL

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 在 `src/lib/db/schema.ts` 文件末尾追加 4 张表定义**

```typescript
// 今日三件事 TL;DR（每天一条）
export const dailyTldrs = sqliteTable('daily_tldrs', {
  id: text('id').primaryKey(),
  digestDate: text('digest_date').notNull(),
  headline: text('headline').notNull(),
  items: text('items', { mode: 'json' }).$type<Array<{ title: string; why: string; digestItemId: string }>>().notNull(),
  observation: text('observation').notNull(),
  generatedAt: text('generated_at').notNull(),
}, (table) => ({
  dateUnique: uniqueIndex('idx_daily_tldrs_date').on(table.digestDate),
}))

// 稍后读队列
export const readingQueue = sqliteTable('reading_queue', {
  id: text('id').primaryKey(),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id, { onDelete: 'cascade' }),
  addedAt: text('added_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  readAt: text('read_at'),
}, (table) => ({
  itemUnique: uniqueIndex('idx_reading_queue_item').on(table.digestItemId),
}))

// 实体订阅
export const entitySubscriptions = sqliteTable('entity_subscriptions', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => topicEntities.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  lastNotifiedAt: text('last_notified_at'),
  notifyCount: integer('notify_count').default(0),
}, (table) => ({
  entityUnique: uniqueIndex('idx_entity_subscriptions_entity').on(table.entityId),
}))

// 每周洞察摘要
export const weeklyInsights = sqliteTable('weekly_insights', {
  id: text('id').primaryKey(),
  weekStart: text('week_start').notNull(),
  weekEnd: text('week_end').notNull(),
  content: text('content', { mode: 'json' }).$type<{
    highlights: Array<{ title: string; insight: string; source: string }>
    observation: string
    keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
  }>().notNull(),
  generatedAt: text('generated_at').notNull(),
}, (table) => ({
  weekUnique: uniqueIndex('idx_weekly_insights_week').on(table.weekStart),
}))
```

- [ ] **Step 2: 在 `src/lib/db/index.ts` 的 `export const db` 之前追加 bootstrap DDL**

```typescript
// Spec 1：读-洞察体验升级表
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS daily_tldrs (
    id TEXT PRIMARY KEY,
    digest_date TEXT NOT NULL,
    headline TEXT NOT NULL,
    items TEXT NOT NULL,
    observation TEXT NOT NULL,
    generated_at TEXT NOT NULL
  )
`)
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tldrs_date ON daily_tldrs(digest_date)`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS reading_queue (
    id TEXT PRIMARY KEY,
    digest_item_id TEXT NOT NULL REFERENCES digest_items(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    read_at TEXT
  )
`)
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_queue_item ON reading_queue(digest_item_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_reading_queue_expires ON reading_queue(expires_at)`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS entity_subscriptions (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES topic_entities(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_notified_at TEXT,
    notify_count INTEGER DEFAULT 0
  )
`)
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_subscriptions_entity ON entity_subscriptions(entity_id)`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS weekly_insights (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    content TEXT NOT NULL,
    generated_at TEXT NOT NULL
  )
`)
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_insights_week ON weekly_insights(week_start)`)
```

- [ ] **Step 3: 生成 Drizzle migration**

```bash
cd /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia && pnpm db:generate
```

- [ ] **Step 4: 在生成的最新 migration SQL 文件里手动把 `CREATE TABLE` 和 `CREATE INDEX` 改成 `IF NOT EXISTS`**

避免和 runtime bootstrap 冲突。参考上一次 migration `0005` 的修复方式。

- [ ] **Step 5: 运行 migration**

```bash
pnpm db:migrate
```
Expected: migration 应用成功，无错误。

- [ ] **Step 6: 构建验证（不提交）**

```bash
pnpm build
```
Expected: build 通过，schema.ts 无 TypeScript 错误。

---

## Task 2: B1 TL;DR 后端逻辑

**Files:**
- Create: `src/lib/digest/tldr.ts`
- Create: `src/app/api/digest/tldr/route.ts`

- [ ] **Step 1: 创建 `src/lib/digest/tldr.ts`**

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { getModels } from '@/lib/ai/client'
import { db } from '../db/index'
import { digestItems, dailyTldrs } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'

const tldrSchema = z.object({
  headline: z.string().describe('20 字以内的总纲，概括今天最重要的信号'),
  items: z.array(z.object({
    digestItemIndex: z.number().int().describe('输入列表中的索引'),
    why: z.string().describe('为什么这件事重要，30-50 字'),
  })).length(3),
  observation: z.string().describe('贯穿这 3 件事的一个观察或思考，30-80 字'),
})

export async function generateDailyTldr(date: string): Promise<{
  headline: string
  items: Array<{ title: string; why: string; digestItemId: string }>
  observation: string
} | null> {
  // 取当天 Top 20 推荐条目
  const items = db.select().from(digestItems)
    .where(eq(digestItems.digestDate, date))
    .orderBy(desc(digestItems.aiScore))
    .limit(20)
    .all()

  if (items.length === 0) return null

  const itemList = items.map((it, i) =>
    `[${i}] 来源:${it.source} | ${it.title}\n  ${it.oneLiner}`
  ).join('\n\n')

  try {
    const { object } = await generateObject({
      model: getModels().quality,
      schema: tldrSchema,
      prompt: `你是一个面向全栈独立开发者（关注 AI、跨境电商、技术变革）的资讯总编。

以下是 ${date} 的精选资讯（共 ${items.length} 条）：

${itemList}

请从中挑出 3 件最值得关注的事，生成今日三件事简报：
- headline: 用 20 字以内概括今天最核心的信号
- items: 挑出 3 件事（按重要性降序），每件给出 digestItemIndex（对应上面列表的索引）和 why（30-50 字说明为什么重要）
- observation: 给出一个贯穿这 3 件事的思考或判断，30-80 字

要求：items 必须恰好 3 条；优先选评分高、跨源程度高、趋势性强的话题。`,
    })

    const selected = object.items.map(it => ({
      title: items[it.digestItemIndex]?.title || '',
      why: it.why,
      digestItemId: items[it.digestItemIndex]?.id || '',
    })).filter(x => x.digestItemId)

    if (selected.length === 0) return null

    const result = {
      headline: object.headline,
      items: selected,
      observation: object.observation,
    }

    // 写入数据库（UNIQUE 覆盖）
    db.$client.prepare(`
      INSERT INTO daily_tldrs (id, digest_date, headline, items, observation, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(digest_date) DO UPDATE SET
        headline = excluded.headline,
        items = excluded.items,
        observation = excluded.observation,
        generated_at = excluded.generated_at
    `).run(
      uuid(),
      date,
      result.headline,
      JSON.stringify(result.items),
      result.observation,
      new Date().toISOString()
    )

    return result
  } catch (err) {
    console.error('[tldr] 生成失败:', err)
    return null
  }
}

export function getDailyTldr(date: string) {
  const rows = db.$client.prepare(`
    SELECT digest_date as digestDate, headline, items, observation, generated_at as generatedAt
    FROM daily_tldrs WHERE digest_date = ?
  `).all(date) as Array<{
    digestDate: string
    headline: string
    items: string
    observation: string
    generatedAt: string
  }>

  if (rows.length === 0) return null
  const row = rows[0]
  return {
    digestDate: row.digestDate,
    headline: row.headline,
    items: JSON.parse(row.items) as Array<{ title: string; why: string; digestItemId: string }>,
    observation: row.observation,
    generatedAt: row.generatedAt,
  }
}
```

- [ ] **Step 2: 创建 `src/app/api/digest/tldr/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateDailyTldr, getDailyTldr } from '@/lib/digest/tldr'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: '缺少 date 参数' }, { status: 400 })
  const data = getDailyTldr(date)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date = body?.date
  if (!date) return NextResponse.json({ error: '缺少 date 参数' }, { status: 400 })
  try {
    const result = await generateDailyTldr(date)
    if (!result) return NextResponse.json({ error: '该日期无精选条目或生成失败' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

---

## Task 3: B1 TL;DR Pipeline 集成

**Files:**
- Modify: `src/lib/digest/pipeline.ts`

- [ ] **Step 1: 在 pipeline.ts 顶部 import 区新增**

```typescript
import { generateDailyTldr } from './tldr'
```

- [ ] **Step 2: 在 "// 实体提取完成后，检测破圈预警并推送" 这段之前插入 TL;DR 生成**

找到文件里 `try { const crossAlerts = detectCrossSourceAlerts(date) }` 这段代码，**在它之前**插入：

```typescript
    // ── Stage 4: 今日三件事 TL;DR（不阻塞，失败不影响 pipeline） ──
    try {
      progress.detail = '生成今日三件事简报...'
      await saveProgress(runId, progress, date)
      await generateDailyTldr(date)
    } catch (err) {
      console.error('[pipeline] TL;DR 生成失败:', err)
    }
```

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

---

## Task 4: B1 TL;DR 前端卡片

**Files:**
- Create: `src/components/digest/tldr-card.tsx`
- Modify: `src/components/digest/digest-page.tsx`

- [ ] **Step 1: 创建 `src/components/digest/tldr-card.tsx`**

```typescript
"use client"

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TldrData {
  digestDate: string
  headline: string
  items: Array<{ title: string; why: string; digestItemId: string }>
  observation: string
  generatedAt: string
}

export function TldrCard({ date }: { date: string }) {
  const [data, setData] = useState<TldrData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/digest/tldr?date=${date}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [date])

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/digest/tldr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (res.ok) await load()
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) return null
  if (!data) return null

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-warm-accent)]/20 bg-gradient-to-br from-[var(--color-warm-accent)]/5 to-transparent p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--color-warm-accent)]" />
          <h3 className="font-serif-display text-base font-semibold text-foreground">今日三件事</h3>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="重新生成"
        >
          {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </button>
      </div>
      <p className="font-serif-display text-lg font-semibold text-foreground mb-4">{data.headline}</p>
      <ol className="space-y-3 mb-4">
        {data.items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 size-6 rounded-full bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] text-xs font-medium flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.why}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="pt-3 border-t border-border/40">
        <p className="text-xs text-muted-foreground italic leading-relaxed">💡 {data.observation}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/components/digest/digest-page.tsx` 中集成**

在文件顶部 import 区加入：

```typescript
import { TldrCard } from "./tldr-card"
```

在 `<DigestTrigger ... />` 之后、`{loading && ...}` 之前插入：

```tsx
{!loading && hasDigest && <TldrCard date={currentDate} />}
```

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit B1 完整**

```bash
git add -A && git commit -m "功能：B1 今日三件事 TL;DR（Pipeline 末尾合成 + 首页卡片 + 手动重新生成）"
```

---

## Task 5: B2 稍后读队列 后端

**Files:**
- Create: `src/lib/reading-queue/queries.ts`
- Create: `src/app/api/reading-queue/route.ts`
- Create: `src/app/api/reading-queue/[id]/route.ts`

- [ ] **Step 1: 创建 `src/lib/reading-queue/queries.ts`**

```typescript
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
```

- [ ] **Step 2: 创建 `src/app/api/reading-queue/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { addToQueue, listQueue } from '@/lib/reading-queue/queries'

export async function GET() {
  const items = listQueue()
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const digestItemId = body?.digestItemId
  if (!digestItemId) {
    return NextResponse.json({ error: '缺少 digestItemId' }, { status: 400 })
  }
  const id = addToQueue(digestItemId)
  return NextResponse.json({ id })
}
```

- [ ] **Step 3: 创建 `src/app/api/reading-queue/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { removeFromQueue, markRead } from '@/lib/reading-queue/queries'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  markRead(id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  removeFromQueue(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: 构建验证**

```bash
pnpm build
```

---

## Task 6: B2 稍后读按钮 + 收藏页 Tabs

**Files:**
- Create: `src/components/digest/reading-queue-button.tsx`
- Create: `src/components/favorites/favorites-tabs.tsx`
- Create: `src/components/favorites/reading-queue-list.tsx`
- Modify: `src/components/digest/digest-card.tsx`
- Modify: `src/app/favorites/page.tsx`

- [ ] **Step 1: 创建 `src/components/digest/reading-queue-button.tsx`**

```typescript
"use client"

import { useState, useEffect } from 'react'
import { Clock3, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/components/hooks/use-track-event'

export function ReadingQueueButton({ digestItemId }: { digestItemId: string }) {
  const [inQueue, setInQueue] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  // 初始加载时不查询单条状态，点击时做 upsert，状态通过点击切换
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/reading-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digestItemId }),
      })
      if (res.ok) {
        setInQueue(true)
        trackEvent('add_to_reading_queue', 'digest_item', digestItemId)
        setTimeout(() => setInQueue(false), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
        inQueue
          ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      title={inQueue ? '已加入稍后读' : '加入稍后读'}
    >
      {inQueue ? <Check className="size-3" /> : <Clock3 className="size-3" />}
      <span>{inQueue ? '已加入' : '稍后读'}</span>
    </button>
  )
}
```

- [ ] **Step 2: 在 `src/components/digest/digest-card.tsx` 中集成按钮**

读取该文件后，在卡片底部操作区（收藏按钮旁边）加入 `<ReadingQueueButton digestItemId={item.id} />`。保持现有布局一致。

- [ ] **Step 3: 创建 `src/components/favorites/reading-queue-list.tsx`**

```typescript
"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock3, Trash2, ExternalLink } from 'lucide-react'
import { SOURCE_COLORS, SOURCE_META } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface QueueItem {
  id: string
  digestItemId: string
  addedAt: string
  expiresAt: string
  readAt: string | null
  title: string
  source: string
  url: string
  oneLiner: string
  digestDate: string
  aiScore: number
}

export function ReadingQueueList() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reading-queue')
      const json = await res.json()
      setItems(json.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleOpen = async (item: QueueItem) => {
    await fetch(`/api/reading-queue/${item.id}`, { method: 'PATCH' })
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/reading-queue/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) {
    return <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        <Clock3 className="size-8 mx-auto mb-3 opacity-40" />
        <p>还没有稍后读的文章</p>
        <p className="text-xs mt-1">在日报页点击「稍后读」按钮加入队列</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const now = Date.now()
        const expireTime = new Date(item.expiresAt).getTime()
        const hoursLeft = Math.max(0, Math.floor((expireTime - now) / 3600000))
        const expiringSoon = hoursLeft < 72
        const isRead = !!item.readAt
        const sourceMeta = SOURCE_META[item.source]
        const color = SOURCE_COLORS[item.source] || '#9C9590'

        return (
          <div
            key={item.id}
            className={cn(
              'group relative rounded-lg border border-border/60 bg-card p-4 transition-all hover:border-border',
              isRead && 'opacity-50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                  <span className="inline-block size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span>{sourceMeta?.name || item.source}</span>
                  <span>·</span>
                  <span>{item.digestDate}</span>
                  {expiringSoon && (
                    <span className="text-orange-600 dark:text-orange-400">{hoursLeft}h 后过期</span>
                  )}
                </div>
                <Link
                  href={item.url}
                  target="_blank"
                  onClick={() => handleOpen(item)}
                  className="block"
                >
                  <h3 className="font-medium text-sm text-foreground group-hover:text-[var(--color-warm-accent)] transition-colors leading-snug mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.oneLiner}</p>
                </Link>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                title="移除"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: 创建 `src/components/favorites/favorites-tabs.tsx`**

```typescript
"use client"

import { useState } from 'react'
import { Star, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReadingQueueList } from './reading-queue-list'

interface FavoritesTabsProps {
  favoritesContent: React.ReactNode
}

export function FavoritesTabs({ favoritesContent }: FavoritesTabsProps) {
  const [tab, setTab] = useState<'favorites' | 'queue'>('favorites')

  return (
    <div>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit mb-6">
        <button
          onClick={() => setTab('favorites')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            tab === 'favorites'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className="size-3.5" />
          收藏
        </button>
        <button
          onClick={() => setTab('queue')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            tab === 'queue'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Clock3 className="size-3.5" />
          稍后读
        </button>
      </div>
      {tab === 'favorites' ? favoritesContent : <ReadingQueueList />}
    </div>
  )
}
```

- [ ] **Step 5: 修改 `src/app/favorites/page.tsx` 以集成 Tabs**

读取现有内容，把原始的收藏列表包装进 `<FavoritesTabs favoritesContent={...}>`。

- [ ] **Step 6: 构建验证**

```bash
pnpm build
```

- [ ] **Step 7: Commit B2**

```bash
git add -A && git commit -m "功能：B2 稍后读队列（日报卡片按钮 + 收藏页 Tab 切换 + 7 天自动过期）"
```

---

## Task 7: C2 实体订阅 后端

**Files:**
- Create: `src/lib/insights/entity-subscription.ts`
- Create: `src/app/api/entity-subscriptions/route.ts`
- Create: `src/app/api/entity-subscriptions/[id]/route.ts`
- Modify: `src/lib/notify.ts`
- Modify: `src/lib/digest/pipeline.ts`

- [ ] **Step 1: 创建 `src/lib/insights/entity-subscription.ts`**

```typescript
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
```

- [ ] **Step 2: 创建 `src/app/api/entity-subscriptions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { listSubscriptions, subscribe } from '@/lib/insights/entity-subscription'

export async function GET() {
  return NextResponse.json({ items: listSubscriptions() })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const entityId = body?.entityId
  if (!entityId) {
    return NextResponse.json({ error: '缺少 entityId' }, { status: 400 })
  }
  const id = subscribe(entityId)
  return NextResponse.json({ id })
}
```

- [ ] **Step 3: 创建 `src/app/api/entity-subscriptions/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { unsubscribe } from '@/lib/insights/entity-subscription'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  unsubscribe(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: 在 `src/lib/notify.ts` 末尾新增 sendEntityAlerts**

```typescript
import type { SubscriptionMatch } from './insights/entity-subscription'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: '人物',
  company: '公司',
  product: '产品',
  technology: '技术',
}

export async function sendEntityAlerts(matches: SubscriptionMatch[]) {
  if (matches.length === 0) return
  try {
    const rows = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()
    if (rows.length === 0) return
    const config = rows[0]
    if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) return

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const lines: string[] = ['🔔 你关注的话题出现了', '']

    for (const m of matches.slice(0, 5)) {
      const label = ENTITY_TYPE_LABELS[m.entityType] || m.entityType
      lines.push(`▸ ${m.entityName} (${label})`)
      lines.push(`  ${m.newArticles.length} 篇新文章`)
      if (m.newArticles[0]) {
        lines.push(`  · ${m.newArticles[0].title.slice(0, 40)}`)
      }
      lines.push('')
    }
    lines.push(`🔗 详情：${appUrl}/insights`)

    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text: lines.join('\n') }),
    })
  } catch (err) {
    console.error('[notify] 实体订阅推送失败:', err)
  }
}
```

- [ ] **Step 5: 在 `src/lib/digest/pipeline.ts` 中集成订阅检测**

在文件顶部 import 区加入：

```typescript
import { findSubscriptionsToNotify, markNotified } from '@/lib/insights/entity-subscription'
import { sendEntityAlerts } from '@/lib/notify'
```

在「// 实体提取完成后，检测破圈预警并推送」之后、Pipeline 完成之前插入：

```typescript
    // ── 实体订阅推送 ──
    try {
      // 查询当天所有被提及的实体 id
      const entityRows = db.$client.prepare(`
        SELECT DISTINCT ar.entity_id
        FROM article_relations ar
        JOIN digest_items di ON di.id = ar.digest_item_id
        WHERE di.digest_date = ?
      `).all(date) as Array<{ entity_id: string }>
      const entityIds = entityRows.map(r => r.entity_id)
      const matches = findSubscriptionsToNotify(entityIds, date)
      if (matches.length > 0) {
        sendEntityAlerts(matches).catch(err =>
          console.error('[pipeline] 实体订阅推送失败:', err)
        )
        markNotified(matches.map(m => m.subscriptionId))
      }
    } catch (err) {
      console.error('[pipeline] 实体订阅检测失败:', err)
    }
```

- [ ] **Step 6: 构建验证**

```bash
pnpm build
```

---

## Task 8: C2 实体订阅 前端按钮

**Files:**
- Create: `src/components/insights/entity-subscribe-button.tsx`
- Modify: `src/components/insights/entity-graph.tsx`

- [ ] **Step 1: 创建 `src/components/insights/entity-subscribe-button.tsx`**

```typescript
"use client"

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EntitySubscribeButton({ entityId }: { entityId: string }) {
  const [subscribed, setSubscribed] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 加载时查询订阅状态
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/entity-subscriptions')
      const json = await res.json()
      const found = (json.items || []).find((it: { entityId: string; id: string }) => it.entityId === entityId)
      if (found) {
        setSubscribed(true)
        setSubscriptionId(found.id)
      } else {
        setSubscribed(false)
        setSubscriptionId(null)
      }
    }
    load()
  }, [entityId])

  const toggle = async () => {
    if (loading) return
    setLoading(true)
    try {
      if (subscribed && subscriptionId) {
        await fetch(`/api/entity-subscriptions/${subscriptionId}`, { method: 'DELETE' })
        setSubscribed(false)
        setSubscriptionId(null)
      } else {
        const res = await fetch('/api/entity-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId }),
        })
        const json = await res.json()
        setSubscribed(true)
        setSubscriptionId(json.id)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
        subscribed
          ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      title={subscribed ? '取消订阅' : '订阅此实体'}
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : subscribed ? <Bell className="size-3" /> : <BellOff className="size-3" />}
      <span>{subscribed ? '已订阅' : '订阅'}</span>
    </button>
  )
}
```

- [ ] **Step 2: 在 `src/components/insights/entity-graph.tsx` 的实体详情面板中集成**

读取该文件找到右侧详情面板部分（渲染 `EntityDetail` 的地方），在实体标题旁插入：

```tsx
<EntitySubscribeButton entityId={detail.entity.id} />
```

同时 import：

```typescript
import { EntitySubscribeButton } from './entity-subscribe-button'
```

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit C2**

```bash
git add -A && git commit -m "功能：C2 实体订阅（订阅按钮 + Pipeline 推送检测 + Telegram 通知 + 24h 去重）"
```

---

## Task 9: C3 每周洞察 后端

**Files:**
- Create: `src/lib/digest/weekly-insight.ts`
- Create: `src/app/api/insights/weekly/route.ts`
- Modify: `src/lib/scheduler.ts`

- [ ] **Step 1: 创建 `src/lib/digest/weekly-insight.ts`**

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { getModels } from '@/lib/ai/client'
import { db } from '../db/index'

const weeklyInsightSchema = z.object({
  highlights: z.array(z.object({
    title: z.string().describe('事件/话题标题'),
    insight: z.string().describe('从系统性视角的洞察，50-80 字'),
    source: z.string().describe('主要来源'),
  })).length(3),
  observation: z.string().describe('一个贯穿这 3 件事的趋势判断或观察，60-120 字'),
  keyEntities: z.array(z.object({
    index: z.number().int().describe('对应输入的实体索引'),
  })).max(5),
})

// 计算本周一（以给定日期为基准，如果 baseDate 是周日，返回上周一到本周日）
export function getWeekRange(baseDate: Date): { start: string; end: string } {
  const d = new Date(baseDate)
  const day = d.getDay() // 0=Sun, 1=Mon
  // 想取的"上周"：以今天往前推 7 天开始的那个周一
  const daysToLastMonday = day === 0 ? 13 : 6 + day
  const start = new Date(d)
  start.setDate(d.getDate() - daysToLastMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function generateWeeklyInsight(weekStart?: string): Promise<{
  weekStart: string
  weekEnd: string
  highlights: Array<{ title: string; insight: string; source: string }>
  observation: string
  keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
} | null> {
  const range = weekStart
    ? { start: weekStart, end: new Date(new Date(weekStart).getTime() + 6 * 86400000).toISOString().slice(0, 10) }
    : getWeekRange(new Date())

  // 查询本周 Top 50 digest_items
  const items = db.$client.prepare(`
    SELECT id, title, source, one_liner as oneLiner, ai_score as aiScore
    FROM digest_items
    WHERE digest_date >= ? AND digest_date <= ?
    ORDER BY ai_score DESC
    LIMIT 50
  `).all(range.start, range.end) as Array<{
    id: string
    title: string
    source: string
    oneLiner: string
    aiScore: number
  }>

  if (items.length === 0) return null

  // 查询本周新增 Top 20 实体（按 mention_count）
  const entities = db.$client.prepare(`
    SELECT te.id, te.name, te.type, te.mention_count as mentionCount
    FROM topic_entities te
    WHERE te.first_seen_date >= ? AND te.first_seen_date <= ?
    ORDER BY te.mention_count DESC
    LIMIT 20
  `).all(range.start, range.end) as Array<{
    id: string
    name: string
    type: string
    mentionCount: number
  }>

  const itemList = items.slice(0, 30).map((it, i) =>
    `[${i}] ${it.source} | ${it.title}\n  ${it.oneLiner}`
  ).join('\n\n')
  const entityList = entities.map((e, i) =>
    `[${i}] ${e.name} (${e.type}, ${e.mentionCount} 次)`
  ).join('\n')

  try {
    const { object } = await generateObject({
      model: getModels().quality,
      schema: weeklyInsightSchema,
      prompt: `你是一个面向全栈独立开发者（关注 AI、跨境电商、技术变革）的资讯分析师。

这是 ${range.start} 至 ${range.end} 这一周的精选资讯（Top 30）：

${itemList}

本周新增的活跃实体（Top 20）：

${entityList}

请从系统性视角分析本周：
- highlights: 3 件最值得关注的事（不是流水汇总，而是挑出真正有信号价值的事）。每件给出 title / insight（50-80字，从"这意味着什么"的角度）/ source
- observation: 贯穿这 3 件事的一个趋势判断（60-120 字）
- keyEntities: 从实体列表中选 3-5 个最值得关注的，用 index 表示

要求：不要泛泛而谈，要有观点；优先选跨行业/跨源的话题；observation 要有前瞻性。`,
    })

    const keyEntities = object.keyEntities
      .map(ke => entities[ke.index])
      .filter(Boolean)

    const content = {
      highlights: object.highlights,
      observation: object.observation,
      keyEntities,
    }

    db.$client.prepare(`
      INSERT INTO weekly_insights (id, week_start, week_end, content, generated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(week_start) DO UPDATE SET
        week_end = excluded.week_end,
        content = excluded.content,
        generated_at = excluded.generated_at
    `).run(
      uuid(),
      range.start,
      range.end,
      JSON.stringify(content),
      new Date().toISOString()
    )

    return { weekStart: range.start, weekEnd: range.end, ...content }
  } catch (err) {
    console.error('[weekly-insight] 生成失败:', err)
    return null
  }
}

export function getWeeklyInsight(weekStart: string) {
  const rows = db.$client.prepare(`
    SELECT week_start as weekStart, week_end as weekEnd, content, generated_at as generatedAt
    FROM weekly_insights WHERE week_start = ?
  `).all(weekStart) as Array<{
    weekStart: string
    weekEnd: string
    content: string
    generatedAt: string
  }>

  if (rows.length === 0) return null
  const row = rows[0]
  return {
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    ...(JSON.parse(row.content) as {
      highlights: Array<{ title: string; insight: string; source: string }>
      observation: string
      keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
    }),
    generatedAt: row.generatedAt,
  }
}

export function getLatestWeeklyInsight() {
  const row = db.$client.prepare(`
    SELECT week_start as weekStart, week_end as weekEnd, content, generated_at as generatedAt
    FROM weekly_insights ORDER BY week_start DESC LIMIT 1
  `).get() as {
    weekStart: string
    weekEnd: string
    content: string
    generatedAt: string
  } | undefined

  if (!row) return null
  return {
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    ...(JSON.parse(row.content) as {
      highlights: Array<{ title: string; insight: string; source: string }>
      observation: string
      keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
    }),
    generatedAt: row.generatedAt,
  }
}
```

- [ ] **Step 2: 创建 `src/app/api/insights/weekly/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyInsight, getWeeklyInsight, getLatestWeeklyInsight } from '@/lib/digest/weekly-insight'

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get('week')
  const data = weekStart ? getWeeklyInsight(weekStart) : getLatestWeeklyInsight()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const weekStart = body?.weekStart
  try {
    const result = await generateWeeklyInsight(weekStart)
    if (!result) return NextResponse.json({ error: '该周无数据或生成失败' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: 在 `src/lib/scheduler.ts` 里加入每周定时任务**

读取现有 scheduler，追加一段周一凌晨 2 点的 cron（和现有 digest cron 同一个风格）。如果 scheduler 结构不便添加，此步骤跳过（手动触发也可满足需求，不阻塞主流程）。

- [ ] **Step 4: 构建验证**

```bash
pnpm build
```

---

## Task 10: C3 每周洞察 前端卡片

**Files:**
- Create: `src/components/insights/weekly-insight-card.tsx`
- Modify: `src/app/insights/page.tsx`

- [ ] **Step 1: 创建 `src/components/insights/weekly-insight-card.tsx`**

```typescript
"use client"

import { useEffect, useState } from 'react'
import { Lightbulb, RefreshCw, Loader2 } from 'lucide-react'

interface WeeklyInsight {
  weekStart: string
  weekEnd: string
  highlights: Array<{ title: string; insight: string; source: string }>
  observation: string
  keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
  generatedAt: string
}

export function WeeklyInsightCard() {
  const [data, setData] = useState<WeeklyInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insights/weekly')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/insights/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) await load()
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return null

  return (
    <div className="rounded-xl border border-[var(--color-warm-accent)]/20 bg-gradient-to-br from-[var(--color-warm-accent)]/5 to-transparent p-5 mb-10">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="size-4 text-[var(--color-warm-accent)]" />
            <h2 className="font-serif-display text-lg font-semibold text-foreground">本周洞察</h2>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground">{data.weekStart} — {data.weekEnd}</p>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          <span>{generating ? '生成中' : data ? '重新生成' : '生成'}</span>
        </button>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground italic">还没有本周洞察，点击右上「生成」按钮基于本周数据生成</p>
      ) : (
        <>
          <ol className="space-y-3 mb-4">
            {data.highlights.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 size-6 rounded-full bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] text-xs font-medium flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug mb-0.5">{h.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{h.insight}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">— {h.source}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="pt-3 mb-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground italic leading-relaxed">💡 {data.observation}</p>
          </div>
          {data.keyEntities.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">本周关键实体</p>
              <div className="flex flex-wrap gap-1.5">
                {data.keyEntities.map(e => (
                  <span key={e.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-foreground">
                    {e.name}
                    <span className="text-muted-foreground">·{e.mentionCount}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/app/insights/page.tsx` 顶部插入 WeeklyInsightCard**

在 import 区加入：

```typescript
import { WeeklyInsightCard } from "@/components/insights/weekly-insight-card"
```

在 `<Separator className="mb-8" />` 之后、`{/* 手动提取入口 */}` 之前插入：

```tsx
<WeeklyInsightCard />
```

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit C3**

```bash
git add -A && git commit -m "功能：C3 每周洞察摘要（3 件值得关注的事 + 趋势观察 + 关键实体，API 手动触发）"
```

---

## Task 11: Spec 1 收尾 —— 完整构建和测试

- [ ] **Step 1: 全量 build**

```bash
pnpm build
```
Expected: 所有路由编译通过，无错误。

- [ ] **Step 2: 运行测试**

```bash
pnpm test
```
Expected: 12+ tests pass（至少不 regress 现有测试）。

- [ ] **Step 3: 验证 DB migration 已应用**

```bash
sqlite3 data/automedia.db ".tables" | tr ' ' '\n' | grep -E "(daily_tldrs|reading_queue|entity_subscriptions|weekly_insights)"
```
Expected: 4 张新表都出现。

- [ ] **Step 4: 最终 Commit（如果 Task 1 的 migration 未单独提交）**

```bash
git status
git add -A && git commit -m "Spec 1：读-洞察体验升级全部完成（build + test 通过）"
```

---

## Self-Review

**Spec 覆盖：**
- B1 TL;DR → Task 2-4 ✓
- B2 稍后读 → Task 5-6 ✓
- C2 实体订阅 → Task 7-8 ✓
- C3 周洞察 → Task 9-10 ✓
- Schema + build + test → Task 1, 11 ✓

**Placeholder：** 无。Task 9 Step 3 的 scheduler 有"如结构不便可跳过"的 escape hatch，但这是务实的降级而非 placeholder。

**类型一致性：** `SubscriptionMatch`、`QueueItem`、`TldrData`、`WeeklyInsight` 在各文件间一致。

**范围：** 4 个子功能在一个 plan 内，~15 新文件 + ~10 修改，规模可控。

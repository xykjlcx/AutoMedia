# AutoMedia 每日资讯聚合 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 AI 驱动的每日资讯聚合 Web 应用，从多平台采集内容，经 AI 筛选、去重、摘要后以日报形式展示。

**Architecture:** Next.js 全栈应用，SQLite 存储，RSSHub 公域采集 + Agent Browser 私域采集（私域采集预留接口，MVP 先跑通公域），Claude API 做评分和摘要，Embedding 做跨源去重。前端按信息源分组展示每日精选，支持历史回溯和收藏。

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + Drizzle ORM + SQLite (better-sqlite3) + Claude API (@anthropic-ai/sdk) + RSSHub (Docker)

---

## 文件结构

```
08-AutoMedia/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 全局 layout（导航栏、主题）
│   │   ├── page.tsx                    # 首页（今日日报）
│   │   ├── globals.css                 # 全局样式
│   │   ├── history/
│   │   │   └── page.tsx                # 历史日报页
│   │   ├── favorites/
│   │   │   └── page.tsx                # 收藏页
│   │   └── api/
│   │       ├── digest/
│   │       │   ├── trigger/route.ts    # POST 触发生成日报
│   │       │   ├── status/route.ts     # GET 查询生成进度
│   │       │   └── [date]/route.ts     # GET 获取指定日期日报
│   │       └── favorites/
│   │           ├── route.ts            # GET 列表 / POST 创建收藏
│   │           └── [id]/route.ts       # DELETE 取消收藏 / PATCH 更新标签
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts              # Drizzle schema（4 张表）
│   │   │   ├── index.ts               # 数据库连接单例
│   │   │   └── queries.ts             # 常用查询封装
│   │   ├── collectors/
│   │   │   ├── types.ts               # 采集器统一接口定义
│   │   │   ├── rss.ts                 # RSSHub 公域采集器
│   │   │   └── browser.ts             # 浏览器私域采集器（预留接口）
│   │   ├── ai/
│   │   │   ├── client.ts              # Claude API 客户端
│   │   │   ├── scoring.ts             # AI 评分筛选
│   │   │   ├── clustering.ts          # Embedding 去重聚类
│   │   │   └── summarize.ts           # AI 摘要生成
│   │   ├── pipeline.ts                # 采集 + AI 处理主流程
│   │   └── sources.ts                 # 信息源配置
│   └── components/
│       ├── ui/                         # shadcn/ui 组件（自动生成）
│       ├── layout/
│       │   ├── navbar.tsx              # 顶部导航
│       │   └── container.tsx           # 内容容器
│       ├── digest/
│       │   ├── digest-card.tsx         # 资讯卡片
│       │   ├── source-group.tsx        # 按源分组
│       │   ├── digest-trigger.tsx      # 生成日报按钮 + 进度
│       │   └── date-nav.tsx            # 日期导航（前后翻页）
│       ├── favorites/
│       │   ├── favorite-button.tsx     # 收藏按钮（星标）
│       │   └── tag-manager.tsx         # 标签管理
│       └── history/
│           └── calendar-view.tsx       # 日历视图
├── drizzle.config.ts                   # Drizzle 配置
├── docker-compose.yml                  # RSSHub 部署
├── .env.local                          # 环境变量（API keys）
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── CLAUDE.md                           # 项目级指令
└── .gitignore
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.local`, `CLAUDE.md`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: 初始化 Next.js 项目**

```bash
cd /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-pnpm
```

预期：项目创建成功，`package.json` 中有 next、react、typescript 等依赖。

- [ ] **Step 2: 安装核心依赖**

```bash
pnpm add drizzle-orm better-sqlite3 @anthropic-ai/sdk rss-parser uuid
pnpm add -D drizzle-kit @types/better-sqlite3 @types/uuid
```

- [ ] **Step 3: 安装 shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card badge input dialog scroll-area calendar separator skeleton tooltip
```

- [ ] **Step 4: 创建 .env.local**

```env
ANTHROPIC_API_KEY=用户已有的key
RSSHUB_BASE_URL=http://localhost:1200
DATABASE_PATH=./data/automedia.db
```

- [ ] **Step 5: 创建 .gitignore（追加规则）**

确保 `.gitignore` 包含：
```
data/
.env
.env.*
!.env.example
```

- [ ] **Step 6: 创建 CLAUDE.md**

```markdown
# AutoMedia

## 项目概述
AI 驱动的每日资讯聚合工具。从多平台采集内容，经 AI 筛选、去重、摘要后以日报形式展示。

## 技术栈
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- SQLite + Drizzle ORM
- Claude API (@anthropic-ai/sdk)
- RSSHub (Docker)

## 开发命令
- `pnpm dev` — 启动开发服务器
- `pnpm build` — 构建生产版本
- `pnpm db:generate` — 生成数据库迁移
- `pnpm db:migrate` — 执行数据库迁移
- `docker compose up -d` — 启动 RSSHub

## 目录规范
- `src/lib/collectors/` — 数据采集器
- `src/lib/ai/` — AI 处理管线
- `src/lib/db/` — 数据库相关
- `src/components/` — UI 组件

## 注意事项
- 代码英文，注释中文
- 数据库文件在 `data/` 目录，已 gitignore
- API Key 在 .env.local，不要提交
```

- [ ] **Step 7: 验证项目启动**

```bash
pnpm dev
```

预期：`http://localhost:3000` 能正常访问 Next.js 默认页面。

- [ ] **Step 8: 初始化 git 并提交**

```bash
git init
git add .
git commit -m "初始化 AutoMedia 项目脚手架"
```

---

## Task 2: 数据库 Schema + 配置

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`
- Create: `src/lib/db/queries.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json`（添加 db 脚本）

- [ ] **Step 1: 创建 Drizzle 配置**

`drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/automedia.db',
  },
})
```

- [ ] **Step 2: 定义数据库 Schema**

`src/lib/db/schema.ts`:
```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// 原始采集数据
export const rawItems = sqliteTable('raw_items', {
  id: text('id').primaryKey(), // UUID
  source: text('source').notNull(), // twitter | xiaohongshu | github | wechat | zhihu | juejin | producthunt | hackernews
  sourceType: text('source_type').notNull(), // public | private
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  url: text('url').notNull(),
  author: text('author').default(''),
  rawData: text('raw_data', { mode: 'json' }),
  digestDate: text('digest_date').notNull(), // YYYY-MM-DD
  collectedAt: text('collected_at').notNull(), // ISO 8601
})

// AI 处理后的精选条目
export const digestItems = sqliteTable('digest_items', {
  id: text('id').primaryKey(),
  digestDate: text('digest_date').notNull(),
  source: text('source').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  author: text('author').default(''),
  aiScore: real('ai_score').notNull(),
  oneLiner: text('one_liner').notNull(), // 一句话概述
  summary: text('summary').notNull(), // 详细摘要
  clusterId: text('cluster_id'),
  clusterSources: text('cluster_sources', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').notNull(),
})

// 收藏
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  note: text('note').default(''),
  createdAt: text('created_at').notNull(),
})

// 日报执行记录
export const digestRuns = sqliteTable('digest_runs', {
  id: text('id').primaryKey(),
  digestDate: text('digest_date').notNull(),
  status: text('status').notNull(), // collecting | processing | completed | failed
  progress: text('progress', { mode: 'json' }),
  rawCount: integer('raw_count').default(0),
  filteredCount: integer('filtered_count').default(0),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  errors: text('errors', { mode: 'json' }).$type<Record<string, string>>(),
})
```

- [ ] **Step 3: 创建数据库连接**

`src/lib/db/index.ts`:
```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = process.env.DATABASE_PATH || './data/automedia.db'

// 确保 data 目录存在
const dir = dirname(dbPath)
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
```

- [ ] **Step 4: 创建常用查询封装**

`src/lib/db/queries.ts`:
```typescript
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
```

- [ ] **Step 5: 添加 package.json 脚本**

在 `package.json` 的 `scripts` 中添加：
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

- [ ] **Step 6: 生成并执行迁移**

```bash
pnpm db:generate
pnpm db:migrate
```

预期：`drizzle/` 目录生成迁移文件，`data/automedia.db` 创建成功。

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "添加数据库 schema 和 Drizzle 配置"
```

---

## Task 3: 信息源配置 + 采集器

**Files:**
- Create: `src/lib/sources.ts`
- Create: `src/lib/collectors/types.ts`
- Create: `src/lib/collectors/rss.ts`
- Create: `src/lib/collectors/browser.ts`
- Create: `docker-compose.yml`

- [ ] **Step 1: 定义信息源配置**

`src/lib/sources.ts`:
```typescript
export interface SourceConfig {
  id: string
  name: string
  icon: string // emoji
  type: 'public' | 'private'
  // 公域源的 RSSHub 路径
  rssPath?: string
  // 私域源的目标 URL
  targetUrl?: string
  enabled: boolean
}

export const sources: SourceConfig[] = [
  // 公域源（RSSHub）
  {
    id: 'github',
    name: 'GitHub Trending',
    icon: '💻',
    type: 'public',
    rssPath: '/github/trending/daily/any',
    enabled: true,
  },
  {
    id: 'juejin',
    name: '掘金',
    icon: '⛏️',
    type: 'public',
    rssPath: '/juejin/trending/all/daily',
    enabled: true,
  },
  {
    id: 'zhihu',
    name: '知乎热榜',
    icon: '🔍',
    type: 'public',
    rssPath: '/zhihu/hot',
    enabled: true,
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    icon: '🚀',
    type: 'public',
    rssPath: '/producthunt/today',
    enabled: true,
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: '📰',
    type: 'public',
    rssPath: '/hackernews/best',
    enabled: true,
  },
  // 私域源（浏览器自动化，MVP 暂不启用）
  {
    id: 'twitter',
    name: 'Twitter',
    icon: '🐦',
    type: 'private',
    targetUrl: 'https://x.com/home',
    enabled: false,
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    type: 'private',
    targetUrl: 'https://www.xiaohongshu.com/explore',
    enabled: false,
  },
  {
    id: 'wechat',
    name: '公众号',
    icon: '📖',
    type: 'private',
    targetUrl: 'https://mp.weixin.qq.com',
    enabled: false,
  },
]

export function getEnabledSources() {
  return sources.filter(s => s.enabled)
}

export function getPublicSources() {
  return sources.filter(s => s.type === 'public' && s.enabled)
}

export function getPrivateSources() {
  return sources.filter(s => s.type === 'private' && s.enabled)
}
```

- [ ] **Step 2: 定义采集器接口**

`src/lib/collectors/types.ts`:
```typescript
export interface CollectedItem {
  source: string
  sourceType: 'public' | 'private'
  title: string
  content: string
  url: string
  author: string
}

export interface Collector {
  name: string
  collect(sourceId: string, config: Record<string, string>): Promise<CollectedItem[]>
}
```

- [ ] **Step 3: 实现 RSS 采集器**

`src/lib/collectors/rss.ts`:
```typescript
import Parser from 'rss-parser'
import type { CollectedItem, Collector } from './types'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AutoMedia/1.0',
  },
})

const RSSHUB_BASE = process.env.RSSHUB_BASE_URL || 'http://localhost:1200'

export const rssCollector: Collector = {
  name: 'rss',

  async collect(sourceId: string, config: Record<string, string>): Promise<CollectedItem[]> {
    const rssPath = config.rssPath
    if (!rssPath) throw new Error(`RSS path not configured for source: ${sourceId}`)

    const feedUrl = `${RSSHUB_BASE}${rssPath}`
    const feed = await parser.parseURL(feedUrl)

    return (feed.items || []).map(item => ({
      source: sourceId,
      sourceType: 'public' as const,
      title: item.title?.trim() || '',
      content: stripHtml(item.contentSnippet || item.content || '').slice(0, 2000),
      url: item.link || '',
      author: item.creator || item.author || '',
    })).filter(item => item.title && item.url)
  },
}

// 简单去除 HTML 标签
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
```

- [ ] **Step 4: 创建浏览器采集器占位**

`src/lib/collectors/browser.ts`:
```typescript
import type { CollectedItem, Collector } from './types'

// 私域采集器——需要 Agent Browser 连接本机 Chrome
// MVP 阶段预留接口，后续实现各平台的具体采集逻辑
export const browserCollector: Collector = {
  name: 'browser',

  async collect(sourceId: string, _config: Record<string, string>): Promise<CollectedItem[]> {
    console.log(`[browser] 私域采集器暂未实现: ${sourceId}，跳过`)
    return []
  },
}
```

- [ ] **Step 5: 创建 docker-compose.yml**

`docker-compose.yml`:
```yaml
services:
  rsshub:
    image: diygod/rsshub:latest
    restart: unless-stopped
    ports:
      - "1200:1200"
    environment:
      NODE_ENV: production
      CACHE_TYPE: memory
      CACHE_EXPIRE: 600
```

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "添加信息源配置和采集器"
```

---

## Task 4: AI 处理管线

**Files:**
- Create: `src/lib/ai/client.ts`
- Create: `src/lib/ai/scoring.ts`
- Create: `src/lib/ai/clustering.ts`
- Create: `src/lib/ai/summarize.ts`

- [ ] **Step 1: 创建 Claude API 客户端**

`src/lib/ai/client.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}
```

- [ ] **Step 2: 实现 AI 评分筛选**

`src/lib/ai/scoring.ts`:
```typescript
import { getAnthropicClient } from './client'
import type { CollectedItem } from '../collectors/types'

export interface ScoredItem extends CollectedItem {
  aiScore: number
  scoreBreakdown: {
    relevance: number
    novelty: number
    impact: number
  }
}

const INTEREST_DOMAINS = [
  'AI / 大模型 / Agent / LLM',
  '跨境电商 / Shopify / 独立站 / DTC',
  '技术变革 / 开发者工具 / 开源',
  '互联网产品 / 创业 / SaaS',
]

// 批量评分，每批 10 条
export async function scoreItems(items: CollectedItem[]): Promise<ScoredItem[]> {
  const client = getAnthropicClient()
  const results: ScoredItem[] = []
  const batchSize = 10

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容摘要:${item.content.slice(0, 300)}`
    )).join('\n\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `你是一个资讯筛选 AI。请对以下资讯条目进行评分。

关注领域：
${INTEREST_DOMAINS.map(d => `- ${d}`).join('\n')}

评分维度（每项 0-10 分）：
- relevance: 与关注领域的匹配度
- novelty: 是否有新信息、新观点
- impact: 对行业/技术的影响程度

请严格按 JSON 数组格式返回，每项包含 index、relevance、novelty、impact 三个分数：
[{"index": 0, "relevance": 8, "novelty": 7, "impact": 6}, ...]

资讯列表：
${itemList}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) continue

    try {
      const scores: Array<{ index: number; relevance: number; novelty: number; impact: number }> = JSON.parse(jsonMatch[0])
      for (const score of scores) {
        const item = batch[score.index]
        if (!item) continue
        const aiScore = score.relevance * 0.4 + score.novelty * 0.3 + score.impact * 0.3
        results.push({
          ...item,
          aiScore: Math.round(aiScore * 10) / 10,
          scoreBreakdown: {
            relevance: score.relevance,
            novelty: score.novelty,
            impact: score.impact,
          },
        })
      }
    } catch {
      // 解析失败，跳过这批
      console.error('[scoring] JSON 解析失败，跳过当前批次')
    }
  }

  return results
}

// 按源分组，每源取 top 5，且分数 >= 6
export function filterTopItems(items: ScoredItem[], maxPerSource = 5, minScore = 6): ScoredItem[] {
  const bySource = new Map<string, ScoredItem[]>()

  for (const item of items) {
    if (item.aiScore < minScore) continue
    const list = bySource.get(item.source) || []
    list.push(item)
    bySource.set(item.source, list)
  }

  const result: ScoredItem[] = []
  for (const [, list] of bySource) {
    list.sort((a, b) => b.aiScore - a.aiScore)
    result.push(...list.slice(0, maxPerSource))
  }

  return result
}
```

- [ ] **Step 3: 实现 Embedding 去重聚类**

`src/lib/ai/clustering.ts`:
```typescript
import { getAnthropicClient } from './client'
import type { ScoredItem } from './scoring'

export interface ClusteredItem extends ScoredItem {
  clusterId: string
  clusterSources: string[]
}

// 用 Claude 生成文本的简易 embedding 替代方案：
// 让 Claude 直接判断哪些条目在讨论同一件事
export async function clusterItems(items: ScoredItem[]): Promise<ClusteredItem[]> {
  if (items.length <= 1) {
    return items.map((item, i) => ({
      ...item,
      clusterId: `cluster-${i}`,
      clusterSources: [],
    }))
  }

  const client = getAnthropicClient()

  const itemList = items.map((item, idx) => (
    `[${idx}] 来源:${item.source} | ${item.title}`
  )).join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `以下是来自不同平台的资讯标题。请找出讨论同一事件/话题的条目，将它们分组。

${itemList}

请严格按 JSON 格式返回分组结果，每组是一个索引数组：
{"clusters": [[0, 5], [3, 7, 12], ...]}

只需要返回有重复的组（2个及以上条目的组）。如果没有重复，返回 {"clusters": []}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  // 默认每条独立
  const result: ClusteredItem[] = items.map((item, i) => ({
    ...item,
    clusterId: `cluster-${i}`,
    clusterSources: [],
  }))

  if (!jsonMatch) return result

  try {
    const { clusters } = JSON.parse(jsonMatch[0]) as { clusters: number[][] }
    const merged = new Set<number>()

    for (const group of clusters) {
      if (group.length < 2) continue

      // 找分数最高的作为主条目
      const sorted = [...group].sort((a, b) => (items[b]?.aiScore || 0) - (items[a]?.aiScore || 0))
      const primaryIdx = sorted[0]
      const clusterId = `cluster-${primaryIdx}`

      // 收集同组其他来源
      const otherSources = sorted.slice(1)
        .map(idx => items[idx]?.source)
        .filter((s): s is string => !!s)

      result[primaryIdx].clusterId = clusterId
      result[primaryIdx].clusterSources = otherSources

      // 标记非主条目为已合并
      for (const idx of sorted.slice(1)) {
        merged.add(idx)
      }
    }

    // 过滤掉已合并的条目
    return result.filter((_, i) => !merged.has(i))
  } catch {
    console.error('[clustering] JSON 解析失败，跳过去重')
    return result
  }
}
```

- [ ] **Step 4: 实现 AI 摘要生成**

`src/lib/ai/summarize.ts`:
```typescript
import { getAnthropicClient } from './client'
import type { ClusteredItem } from './clustering'

export interface SummarizedItem extends ClusteredItem {
  oneLiner: string
  summary: string
}

// 批量生成摘要，每批 5 条
export async function summarizeItems(items: ClusteredItem[]): Promise<SummarizedItem[]> {
  const client = getAnthropicClient()
  const results: SummarizedItem[] = []
  const batchSize = 5

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容:${item.content.slice(0, 500)}${item.clusterSources.length > 0 ? `\n跨源讨论:${item.clusterSources.join(', ')}` : ''}`
    )).join('\n\n---\n\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `你是一个资讯摘要 AI，面向一位关注 AI、跨境电商、技术变革的全栈开发者。

请为以下资讯生成摘要。每条需要：
1. one_liner: 一句话概述（中文，30字以内，概括核心信息）
2. summary: 详细摘要（中文，100-150字，包含关键细节和"为什么值得关注"的解读）

请严格按 JSON 数组格式返回：
[{"index": 0, "one_liner": "...", "summary": "..."}, ...]

资讯列表：
${itemList}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) continue

    try {
      const summaries: Array<{ index: number; one_liner: string; summary: string }> = JSON.parse(jsonMatch[0])
      for (const s of summaries) {
        const item = batch[s.index]
        if (!item) continue
        results.push({
          ...item,
          oneLiner: s.one_liner,
          summary: s.summary,
        })
      }
    } catch {
      // 解析失败，用标题作为 fallback
      for (const item of batch) {
        results.push({
          ...item,
          oneLiner: item.title.slice(0, 30),
          summary: item.content.slice(0, 150),
        })
      }
    }
  }

  return results
}
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "实现 AI 处理管线（评分、去重、摘要）"
```

---

## Task 5: Pipeline 主流程

**Files:**
- Create: `src/lib/pipeline.ts`

- [ ] **Step 1: 实现主流程串联**

`src/lib/pipeline.ts`:
```typescript
import { v4 as uuid } from 'uuid'
import { db } from './db/index'
import { rawItems, digestItems, digestRuns } from './db/schema'
import { eq } from 'drizzle-orm'
import { getPublicSources, getPrivateSources } from './sources'
import { rssCollector } from './collectors/rss'
import { browserCollector } from './collectors/browser'
import { scoreItems, filterTopItems } from './ai/scoring'
import { clusterItems } from './ai/clustering'
import { summarizeItems } from './ai/summarize'
import type { CollectedItem } from './collectors/types'

export async function runDigestPipeline(date: string): Promise<string> {
  const runId = uuid()
  const now = new Date().toISOString()

  // 创建执行记录
  await db.insert(digestRuns).values({
    id: runId,
    digestDate: date,
    status: 'collecting',
    progress: { step: 'collecting', detail: '开始采集...' },
    startedAt: now,
  })

  const errors: Record<string, string> = {}
  const allItems: CollectedItem[] = []

  try {
    // ── Stage 0: 采集 ──
    // 公域源
    const publicSources = getPublicSources()
    for (const source of publicSources) {
      try {
        await updateProgress(runId, 'collecting', `采集 ${source.name}...`)
        const items = await rssCollector.collect(source.id, { rssPath: source.rssPath || '' })
        allItems.push(...items)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors[source.id] = msg
        console.error(`[pipeline] ${source.name} 采集失败:`, msg)
      }
    }

    // 私域源
    const privateSources = getPrivateSources()
    for (const source of privateSources) {
      try {
        await updateProgress(runId, 'collecting', `采集 ${source.name}...`)
        const items = await browserCollector.collect(source.id, { targetUrl: source.targetUrl || '' })
        allItems.push(...items)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors[source.id] = msg
      }
    }

    // 写入原始数据
    if (allItems.length > 0) {
      const rawRecords = allItems.map(item => ({
        id: uuid(),
        source: item.source,
        sourceType: item.sourceType,
        title: item.title,
        content: item.content,
        url: item.url,
        author: item.author,
        digestDate: date,
        collectedAt: new Date().toISOString(),
      }))
      await db.insert(rawItems).values(rawRecords)
    }

    await db.update(digestRuns).set({
      rawCount: allItems.length,
      progress: { step: 'processing', detail: `采集完成，共 ${allItems.length} 条，开始 AI 处理...` },
      status: 'processing',
    }).where(eq(digestRuns.id, runId))

    // ── Stage 1: AI 评分筛选 ──
    await updateProgress(runId, 'processing', 'AI 评分筛选中...')
    const scored = await scoreItems(allItems)
    const filtered = filterTopItems(scored)

    // ── Stage 2: 跨源去重 ──
    await updateProgress(runId, 'processing', '跨源去重中...')
    const clustered = await clusterItems(filtered)

    // ── Stage 3: AI 摘要生成 ──
    await updateProgress(runId, 'processing', 'AI 摘要生成中...')
    const summarized = await summarizeItems(clustered)

    // 写入精选数据
    if (summarized.length > 0) {
      // 先清理当天旧数据（支持重新生成）
      await db.delete(digestItems).where(eq(digestItems.digestDate, date))

      const digestRecords = summarized.map(item => ({
        id: uuid(),
        digestDate: date,
        source: item.source,
        title: item.title,
        url: item.url,
        author: item.author,
        aiScore: item.aiScore,
        oneLiner: item.oneLiner,
        summary: item.summary,
        clusterId: item.clusterId,
        clusterSources: item.clusterSources,
        createdAt: new Date().toISOString(),
      }))
      await db.insert(digestItems).values(digestRecords)
    }

    // 完成
    await db.update(digestRuns).set({
      status: 'completed',
      filteredCount: summarized.length,
      completedAt: new Date().toISOString(),
      progress: { step: 'completed', detail: `完成！共 ${summarized.length} 条精选` },
      errors: Object.keys(errors).length > 0 ? errors : null,
    }).where(eq(digestRuns.id, runId))

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.update(digestRuns).set({
      status: 'failed',
      completedAt: new Date().toISOString(),
      progress: { step: 'failed', detail: msg },
      errors: { ...errors, pipeline: msg },
    }).where(eq(digestRuns.id, runId))
  }

  return runId
}

async function updateProgress(runId: string, status: string, detail: string) {
  await db.update(digestRuns).set({
    progress: { step: status, detail },
  }).where(eq(digestRuns.id, runId))
}
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "实现 Pipeline 主流程串联"
```

---

## Task 6: API Routes

**Files:**
- Create: `src/app/api/digest/trigger/route.ts`
- Create: `src/app/api/digest/status/route.ts`
- Create: `src/app/api/digest/[date]/route.ts`
- Create: `src/app/api/favorites/route.ts`
- Create: `src/app/api/favorites/[id]/route.ts`

- [ ] **Step 1: 触发生成日报 API**

`src/app/api/digest/trigger/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { runDigestPipeline } from '@/lib/pipeline'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const date = (body as { date?: string }).date || new Date().toISOString().slice(0, 10)

  // 异步执行，不阻塞响应
  const runId = runDigestPipeline(date)
    .catch(err => console.error('[trigger] Pipeline error:', err))

  // 立即返回，前端轮询 status 接口
  return NextResponse.json({ date, message: '日报生成已启动' })
}
```

- [ ] **Step 2: 查询生成进度 API**

`src/app/api/digest/status/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getDigestRunStatus } from '@/lib/db/queries'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const runs = await getDigestRunStatus(date)
  if (runs.length === 0) {
    return NextResponse.json({ status: 'none', date })
  }

  const run = runs[0]
  return NextResponse.json({
    status: run.status,
    date: run.digestDate,
    progress: run.progress,
    rawCount: run.rawCount,
    filteredCount: run.filteredCount,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errors: run.errors,
  })
}
```

- [ ] **Step 3: 获取指定日期日报 API**

`src/app/api/digest/[date]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getDigestByDate, getDigestDates } from '@/lib/db/queries'
import { db } from '@/lib/db/index'
import { favorites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params
  const items = await getDigestByDate(date)

  // 查询收藏状态
  const allFavorites = await db.select().from(favorites)
  const favoritedIds = new Set(allFavorites.map(f => f.digestItemId))

  const itemsWithFavorite = items.map(item => ({
    ...item,
    isFavorited: favoritedIds.has(item.id),
  }))

  // 按来源分组
  const grouped: Record<string, typeof itemsWithFavorite> = {}
  for (const item of itemsWithFavorite) {
    if (!grouped[item.source]) grouped[item.source] = []
    grouped[item.source].push(item)
  }

  const dates = await getDigestDates()

  return NextResponse.json({ date, groups: grouped, availableDates: dates })
}
```

- [ ] **Step 4: 收藏 CRUD API**

`src/app/api/favorites/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'
import { favorites } from '@/lib/db/schema'
import { getFavorites } from '@/lib/db/queries'

export async function GET() {
  const items = await getFavorites()
  return NextResponse.json({ favorites: items })
}

export async function POST(request: Request) {
  const body = await request.json() as { digestItemId: string; tags?: string[]; note?: string }

  const id = uuid()
  await db.insert(favorites).values({
    id,
    digestItemId: body.digestItemId,
    tags: body.tags || [],
    note: body.note || '',
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ id })
}
```

`src/app/api/favorites/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { favorites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.delete(favorites).where(eq(favorites.id, id))
  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { tags?: string[]; note?: string }

  const updates: Record<string, unknown> = {}
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.note !== undefined) updates.note = body.note

  await db.update(favorites).set(updates).where(eq(favorites.id, id))
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "添加 API Routes（日报触发/进度/数据/收藏）"
```

---

## Task 7: 前端 — 全局 Layout + 导航

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/layout/navbar.tsx`
- Create: `src/components/layout/container.tsx`

使用 **frontend-design skill** 设计美观的整体布局和导航。

参考设计方向：
- 简洁现代的阅读体验，类似 Readwise Reader / Feedly 的干净风格
- 顶部导航栏：左侧 Logo（AutoMedia），右侧导航链接（今日日报 / 历史 / 收藏）
- 主内容区域居中，最大宽度 768px，适合阅读
- 暗色/亮色主题支持（默认亮色）
- 整体色调：以中性色为主，信息源图标用彩色点缀

- [ ] **Step 1: 使用 frontend-design skill 设计并实现全局 Layout**

调用 `frontend-design` skill，提供以下设计需求：
- 全局 layout：顶部导航 + 居中内容区
- 导航栏组件
- 容器组件
- globals.css 样式调整

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "实现全局 Layout 和导航栏"
```

---

## Task 8: 前端 — 首页（今日日报）

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/digest/digest-trigger.tsx`
- Create: `src/components/digest/digest-card.tsx`
- Create: `src/components/digest/source-group.tsx`
- Create: `src/components/digest/date-nav.tsx`
- Create: `src/components/favorites/favorite-button.tsx`

使用 **frontend-design skill** 设计资讯卡片和日报展示。

核心交互：
- 顶部：日期 + 前后翻页 + "生成今日日报"按钮
- 生成中显示进度状态（轮询 /api/digest/status）
- 按信息源分组展示卡片
- 每张卡片：来源图标 + 标题 + 一句话概述 + 可展开的详细摘要 + 跨源标记 + 原文链接 + 收藏按钮

- [ ] **Step 1: 使用 frontend-design skill 设计并实现首页**

调用 `frontend-design` skill，实现：
- 日报触发按钮 + 进度展示组件
- 资讯卡片组件（展开/收起交互）
- 按源分组展示组件
- 日期导航组件
- 收藏按钮组件
- 首页页面组合

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "实现首页（今日日报展示）"
```

---

## Task 9: 前端 — 历史页 + 收藏页

**Files:**
- Create: `src/app/history/page.tsx`
- Create: `src/app/favorites/page.tsx`
- Create: `src/components/history/calendar-view.tsx`
- Create: `src/components/favorites/tag-manager.tsx`

使用 **frontend-design skill** 设计历史和收藏页面。

- [ ] **Step 1: 使用 frontend-design skill 设计并实现历史页和收藏页**

历史页：
- 日历视图，标记有日报的日期
- 点击日期跳转到对应日期的日报

收藏页：
- 收藏列表，每条显示卡片信息 + 标签 + 备注
- 按标签筛选
- 搜索框搜索收藏内容
- 标签管理（添加/删除标签）

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "实现历史页和收藏页"
```

---

## Task 10: 集成验证

- [ ] **Step 1: 启动 RSSHub**

```bash
cd /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia
docker compose up -d
```

验证：`curl http://localhost:1200` 返回 RSSHub 页面。

- [ ] **Step 2: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 3: 在浏览器中测试完整流程**

1. 打开 `http://localhost:3000`
2. 点击"生成今日日报"
3. 观察进度状态更新
4. 确认日报展示正常（按源分组、卡片展开收起、原文链接）
5. 测试收藏功能
6. 测试历史页日历
7. 测试收藏页标签筛选

- [ ] **Step 4: 修复发现的问题**

- [ ] **Step 5: 最终提交**

```bash
git add .
git commit -m "集成验证并修复问题"
```

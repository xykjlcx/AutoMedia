# AutoMedia 功能批量扩展 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AutoMedia 添加 8 个功能：信息源管理、已读/未读、全文搜索、暗色模式、Telegram 推送、定时生成、私域采集、周报汇总。

**Architecture:** 所有功能独立实现，共享同一次 DB 迁移。信息源从硬编码改为 DB 驱动。Pipeline 完成后触发通知。定时任务用 node-cron。私域采集通过调用 Agent Browser CLI。搜索用 SQLite FTS5。

**Tech Stack:** Next.js 16 + Drizzle ORM + SQLite FTS5 + node-cron + next-themes + Agent Browser CLI

---

## Task 1: DB Schema 扩展 + 迁移

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `package.json`

- [ ] **Step 1: 扩展 schema**

在 `src/lib/db/schema.ts` 中添加：

```typescript
// 在 digestItems 表添加 isRead 字段
// 修改 digestItems 定义，在 createdAt 后添加：
  isRead: integer('is_read', { mode: 'boolean' }).default(false),

// 信息源配置表（替代硬编码的 sources.ts）
export const sourceConfigs = sqliteTable('source_configs', {
  id: text('id').primaryKey(), // 如 'github', 'custom-rss-1'
  name: text('name').notNull(),
  icon: text('icon').notNull().default('📰'),
  type: text('type').notNull(), // 'public' | 'private' | 'custom-rss'
  rssPath: text('rss_path').default(''), // RSSHub 路径
  rssUrl: text('rss_url').default(''), // 自定义 RSS 完整 URL
  targetUrl: text('target_url').default(''), // 私域采集目标 URL
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  maxItems: integer('max_items').default(5), // 每源最大条数
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').notNull(),
})

// 定时任务配置
export const scheduleConfig = sqliteTable('schedule_config', {
  id: text('id').primaryKey(), // 固定 'default'
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  cronExpression: text('cron_expression').default('0 6 * * *'), // 默认每天 6:00
  telegramEnabled: integer('telegram_enabled', { mode: 'boolean' }).default(false),
  telegramChatId: text('telegram_chat_id').default(''),
  updatedAt: text('updated_at').notNull(),
})
```

- [ ] **Step 2: 生成迁移并执行**

```bash
pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: 写入默认信息源数据**

创建 `src/lib/db/seed.ts`，将当前硬编码的 sources 写入 DB（如果表为空）：

```typescript
import { db } from './index'
import { sourceConfigs } from './schema'

const DEFAULT_SOURCES = [
  { id: 'github', name: 'GitHub Trending', icon: '💻', type: 'public', rssPath: '/github/trending/daily/any', enabled: true, sortOrder: 0 },
  { id: 'juejin', name: '掘金', icon: '⛏️', type: 'public', rssPath: '/juejin/trending/all/daily', enabled: true, sortOrder: 1 },
  { id: 'zhihu', name: '知乎热榜', icon: '🔍', type: 'public', rssPath: '/zhihu/hot', enabled: true, sortOrder: 2 },
  { id: 'producthunt', name: 'Product Hunt', icon: '🚀', type: 'public', rssPath: '/producthunt/today', enabled: true, sortOrder: 3 },
  { id: 'hackernews', name: 'Hacker News', icon: '📰', type: 'public', rssPath: '/hackernews/best', enabled: true, sortOrder: 4 },
  { id: 'twitter', name: 'Twitter', icon: '🐦', type: 'private', targetUrl: 'https://x.com/home', enabled: false, sortOrder: 5 },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', type: 'private', targetUrl: 'https://www.xiaohongshu.com/explore', enabled: false, sortOrder: 6 },
  { id: 'wechat', name: '公众号', icon: '📖', type: 'private', targetUrl: 'https://mp.weixin.qq.com', enabled: false, sortOrder: 7 },
]

export function seedDefaultSources() {
  const existing = db.select().from(sourceConfigs).all()
  if (existing.length > 0) return // 已有数据，跳过

  const now = new Date().toISOString()
  for (const s of DEFAULT_SOURCES) {
    db.insert(sourceConfigs).values({ ...s, maxItems: 5, createdAt: now }).run()
  }
}
```

在 `src/lib/db/index.ts` 末尾调用 `seedDefaultSources()`。

- [ ] **Step 4: 改造 sources.ts 从 DB 读取**

改写 `src/lib/sources.ts`，从 DB 读取配置而不是硬编码：

```typescript
import { db } from './db/index'
import { sourceConfigs } from './db/schema'
import { eq, asc } from 'drizzle-orm'

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
  return db.select().from(sourceConfigs).orderBy(asc(sourceConfigs.sortOrder)).all()
}

export function getEnabledSources(): SourceConfig[] {
  return getAllSources().filter(s => s.enabled)
}

export function getPublicSources(): SourceConfig[] {
  return getAllSources().filter(s => (s.type === 'public' || s.type === 'custom-rss') && s.enabled)
}

export function getPrivateSources(): SourceConfig[] {
  return getAllSources().filter(s => s.type === 'private' && s.enabled)
}
```

- [ ] **Step 5: 更新 pipeline.ts 适配新 sources 接口**

`pipeline.ts` 中 RSS 采集器需要兼容 `rssUrl`（自定义 RSS）和 `rssPath`（RSSHub）：
- 如果 `source.rssUrl` 非空，直接用完整 URL
- 否则用 `RSSHUB_BASE + source.rssPath`

- [ ] **Step 6: 更新 constants.ts 从 DB 读取**

改写 `src/lib/constants.ts`，SOURCE_META 和 SOURCE_COLORS 从 DB 的 sourceConfigs 动态生成，或改为组件直接使用 source 对象上的 icon/name。

- [ ] **Step 7: 提交**

```bash
git add . && git commit -m "扩展 DB schema：信息源表、已读字段、定时配置"
```

---

## Task 2: 信息源管理 UI

**Files:**
- Create: `src/app/api/sources/route.ts` — GET/POST 信息源 CRUD
- Create: `src/app/api/sources/[id]/route.ts` — PATCH/DELETE 单个源
- 在 `src/app/settings/page.tsx` 中新增"信息源管理"区块

- [ ] **Step 1: 实现信息源 API**

GET `/api/sources` — 返回所有源列表
POST `/api/sources` — 添加新源（自定义 RSS）
PATCH `/api/sources/[id]` — 更新源（启用/禁用、改名、改路径、改 maxItems）
DELETE `/api/sources/[id]` — 删除源

- [ ] **Step 2: 在设置页添加信息源管理区块**

在 `src/app/settings/page.tsx` 中添加新的 section：
- 列出所有信息源，每行：图标 + 名称 + 类型 tag + 启用/禁用 toggle + 每源数量选择器
- "添加自定义 RSS" 按钮：弹出 dialog 填写名称、RSS URL、图标
- 删除按钮（仅自定义源可删）
- 拖拽排序（可选，用 sortOrder 实现简单的上下箭头）

- [ ] **Step 3: RSS 采集器支持自定义 URL**

修改 `src/lib/collectors/rss.ts`，`collect` 方法支持直接传入完整 URL（当 `config.rssUrl` 存在时）。

- [ ] **Step 4: 提交**

---

## Task 3: 已读/未读标记

**Files:**
- Create: `src/app/api/digest/read/route.ts` — POST 标记已读
- Modify: `src/app/api/digest/[date]/route.ts` — 返回 isRead
- Modify: `src/components/digest/digest-card.tsx` — 未读标记 UI

- [ ] **Step 1: 实现标记已读 API**

POST `/api/digest/read`，body: `{ ids: string[] }`，批量标记 `is_read = true`。

- [ ] **Step 2: digest API 返回 isRead 字段**

`/api/digest/[date]` 返回的每个 item 添加 `isRead` 字段。

- [ ] **Step 3: 卡片 UI 添加未读标记**

- 未读条目在标题左侧显示一个小圆点（暖色）
- 展开详情后自动标记已读（调 API）
- 日报顶部显示"X 条未读"

- [ ] **Step 4: 提交**

---

## Task 4: 全文搜索

**Files:**
- Create: `src/app/api/search/route.ts` — GET 搜索 API
- Create: `src/app/search/page.tsx` — 搜索页面
- Modify: `src/components/layout/navbar.tsx` — 添加搜索入口
- Modify: `src/lib/pipeline.ts` — 生成后更新 FTS 索引

- [ ] **Step 1: 创建 FTS5 虚拟表**

在 `src/lib/db/index.ts` 中，连接建立后执行 raw SQL 创建 FTS5 表：
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS digest_fts USING fts5(
  digest_item_id UNINDEXED,
  title,
  one_liner,
  summary,
  source UNINDEXED,
  digest_date UNINDEXED
);
```

- [ ] **Step 2: Pipeline 完成后插入 FTS 索引**

在 `pipeline.ts` 写入 `digestItems` 后，同时插入 FTS 表。

- [ ] **Step 3: 实现搜索 API**

GET `/api/search?q=关键词&limit=20`
- 用 FTS5 的 `MATCH` 查询
- 返回匹配的 digest items + snippet 高亮

- [ ] **Step 4: 搜索页面**

`/search` 页面：搜索框 + 实时搜索结果列表（debounce 300ms）。复用 DigestCard 展示结果。

- [ ] **Step 5: 导航栏添加搜索图标**

点击搜索图标跳转到 `/search`。

- [ ] **Step 6: 提交**

---

## Task 5: 暗色模式

**Files:**
- Install: `next-themes`
- Modify: `src/app/layout.tsx` — 添加 ThemeProvider
- Create: `src/components/layout/theme-toggle.tsx` — 主题切换按钮
- Modify: `src/components/layout/navbar.tsx` — 添加切换按钮

- [ ] **Step 1: 安装 next-themes**

```bash
pnpm add next-themes
```

- [ ] **Step 2: 添加 ThemeProvider**

在 `layout.tsx` 中用 `ThemeProvider` 包裹 body 内容，`attribute="class"`，`defaultTheme="light"`。

- [ ] **Step 3: 创建主题切换按钮**

`theme-toggle.tsx`：Sun/Moon 图标切换，用 `useTheme()` hook。

- [ ] **Step 4: 导航栏添加切换按钮**

放在导航链接右侧。

- [ ] **Step 5: 验证暗色模式下的暖色调**

确保 `.dark` CSS 变量中的自定义暖色（warm-accent 等）在暗色背景下有足够对比度，必要时调整。

- [ ] **Step 6: 提交**

---

## Task 6: Telegram 推送

**Files:**
- Create: `src/lib/notify.ts` — 通知模块
- Modify: `src/lib/pipeline.ts` — 完成后调用通知
- 在 settings 页添加 Telegram 配置区块
- Create: `src/app/api/settings/schedule/route.ts` — 定时/通知配置 API

- [ ] **Step 1: 实现通知模块**

`src/lib/notify.ts`：
- 读取 `scheduleConfig` 表的 Telegram 配置
- 如果 `telegramEnabled && telegramChatId`，调用 Telegram Bot API 发消息
- 消息内容："📰 AutoMedia 日报已就绪\n日期：{date}\n共 {count} 条精选\n🔗 http://localhost:3000/?date={date}"
- 用 `fetch` 直接调 Telegram Bot API（`https://api.telegram.org/bot{token}/sendMessage`）

- [ ] **Step 2: Pipeline 完成后触发通知**

在 `pipeline.ts` 的 `status: 'completed'` 后调用 `sendDigestNotification(date, count)`。

- [ ] **Step 3: 设置页添加通知配置**

在 settings 页添加 section：
- Telegram Bot Token 输入框
- Chat ID 输入框
- 启用/禁用开关
- "发送测试消息"按钮

- [ ] **Step 4: 提交**

---

## Task 7: 定时自动生成

**Files:**
- Install: `node-cron`
- Create: `src/lib/scheduler.ts` — 定时任务管理
- Modify: `src/app/api/settings/schedule/route.ts` — 定时配置 API（与 Task 6 共用）
- 在 settings 页添加定时配置区块

- [ ] **Step 1: 安装 node-cron**

```bash
pnpm add node-cron && pnpm add -D @types/node-cron
```

- [ ] **Step 2: 实现定时任务管理器**

`src/lib/scheduler.ts`：
- `startScheduler()`: 读取 DB 配置，启动 cron job
- `stopScheduler()`: 停止当前 job
- `restartScheduler()`: 重读配置并重启
- 使用 `instrumentation.ts`（Next.js server startup hook）在服务启动时调用 `startScheduler()`

- [ ] **Step 3: 设置页添加定时配置**

在 settings 页添加 section：
- 启用/禁用定时生成开关
- Cron 表达式输入框（带常用预设：每天 6:00、每天 7:00、每 12 小时）
- 下次执行时间预览
- 保存后自动 `restartScheduler()`

- [ ] **Step 4: 提交**

---

## Task 8: 周报/月报汇总

**Files:**
- Create: `src/lib/ai/weekly-summary.ts` — 周报生成逻辑
- Create: `src/app/api/digest/summary/route.ts` — 周报 API
- Create: `src/app/summary/page.tsx` — 周报页面
- Modify: `src/components/layout/navbar.tsx` — 添加周报入口

- [ ] **Step 1: 实现周报生成逻辑**

`src/lib/ai/weekly-summary.ts`：
- 查询指定时间范围内的所有 `digestItems`
- 按来源统计条数，找出 top 话题
- 调用 AI（quality model）生成本周/本月综述：
  - 本周要点（3-5 条最重要的资讯）
  - 趋势洞察（AI 分析这周的信息有什么共同趋势）
  - 来源活跃度统计

- [ ] **Step 2: 实现周报 API**

GET `/api/digest/summary?type=weekly&date=2026-04-03`
- `type`: `weekly` 或 `monthly`
- `date`: 基准日期，往前推一周/一月
- 返回 AI 生成的汇总 + 统计数据

- [ ] **Step 3: 周报页面**

`/summary` 页面：
- 切换"本周"/"本月"
- 显示 AI 生成的综述
- 显示来源分布饼图（简单 CSS 实现）
- 显示 Top 5 高分条目

- [ ] **Step 4: 导航栏添加入口**

导航栏添加"汇总"链接。

- [ ] **Step 5: 提交**

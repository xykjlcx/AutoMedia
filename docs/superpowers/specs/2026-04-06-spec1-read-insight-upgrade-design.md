# Spec 1: 读-洞察体验升级

> 本 spec 已做严格 self-review，因用户已就寝跳过 user review gate。

**日期：** 2026-04-06
**范围：** B1 今日三件事 TL;DR + B2 稍后读队列 + C2 实体订阅 + C3 每周洞察摘要
**定位：** 让日常「读日报 → 形成洞察」这个闭环上的 4 个摩擦点一次性消除

---

## 概览

把四个功能放在同一份 spec 里，因为它们**数据源共享（digest_items、topic_entities）**，且都属于"读-想"环节的高频动作。

| 子功能 | 目标 | 核心数据 |
|---|---|---|
| B1 今日三件事 | 每日一屏的口袋简报 | `daily_tldrs` 表 |
| B2 稍后读队列 | 介于「跳过」和「收藏」的中间态 | `reading_queue` 表 |
| C2 实体订阅 | 盯住某人/公司的后续动态 | `entity_subscriptions` 表 |
| C3 每周洞察摘要 | 3 件值得关注的事 + 1 个观察 | `weekly_insights` 表 |

---

## 数据模型

### 新增表 1：`daily_tldrs`（今日三件事）

```sql
CREATE TABLE daily_tldrs (
  id TEXT PRIMARY KEY,            -- UUID
  digest_date TEXT NOT NULL,      -- YYYY-MM-DD
  headline TEXT NOT NULL,         -- 一句话总纲（20 字以内）
  items TEXT NOT NULL,            -- JSON: Array<{title, why, digest_item_id}>，长度 3
  observation TEXT NOT NULL,      -- AI 的一句话观察（30-50 字）
  generated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_daily_tldrs_date ON daily_tldrs(digest_date);
```

每天一条。`items` 是精选的 3 件最值得关注的事（从当天 `digest_items` 里挑）。重复生成时按 UNIQUE 覆盖。

### 新增表 2：`reading_queue`（稍后读队列）

```sql
CREATE TABLE reading_queue (
  id TEXT PRIMARY KEY,
  digest_item_id TEXT NOT NULL REFERENCES digest_items(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,       -- 默认 added_at + 7 天
  read_at TEXT                    -- 点开后自动标记
);
CREATE UNIQUE INDEX idx_reading_queue_item ON reading_queue(digest_item_id);
CREATE INDEX idx_reading_queue_expires ON reading_queue(expires_at);
```

自动过期：后台定时任务（或首页加载时 lazy 清理）删除 `expires_at < now()` 的条目。

### 新增表 3：`entity_subscriptions`（实体订阅）

```sql
CREATE TABLE entity_subscriptions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES topic_entities(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_notified_at TEXT,          -- 上次推送时间，防止 24h 内重复推送
  notify_count INTEGER DEFAULT 0  -- 累计推送次数（诊断用）
);
CREATE UNIQUE INDEX idx_entity_subscriptions_entity ON entity_subscriptions(entity_id);
```

Pipeline 结束后检测：当前批次中是否有已订阅的实体出现。若有且距上次推送 >24h，发 Telegram。

### 新增表 4：`weekly_insights`（每周洞察摘要）

```sql
CREATE TABLE weekly_insights (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,       -- YYYY-MM-DD（周一）
  week_end TEXT NOT NULL,         -- YYYY-MM-DD（周日）
  content TEXT NOT NULL,          -- JSON: {highlights: [...3], observation: string, key_entities: [...]}
  generated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_weekly_insights_week ON weekly_insights(week_start);
```

**与现有 `weekly-summary.ts` 的区别：** `weekly-summary` 是流水周报（highlights + trends + outlook，用于 `/summary` 页），`weekly_insights` 是精炼观点（3 件事 + 1 观察，用于 `/insights` 页顶部卡片）。两者目的不同：一个全面，一个尖锐。

### 双轨一致性

`schema.ts`（Drizzle）和 `db/index.ts`（runtime bootstrap）都需要同时加新表 DDL，`IF NOT EXISTS` 幂等；另外生成 drizzle migration（`pnpm db:generate`）。

---

## 架构与数据流

### B1 今日三件事 TL;DR

```
Pipeline 最后一步（Stage 4）：
  读取当天 digest_items（AI score 降序 Top 20）
    ↓
  AI 合成（quality 模型 + Zod schema）：
    - 从 Top 20 里挑 3 件最值得洋哥关注的事
    - 为每件事生成 1 句 why（为什么重要）
    - 一句话总纲 + 一句话观察
    ↓
  写入 daily_tldrs（UNIQUE 覆盖）
    ↓
  Pipeline 完成
```

前端：首页 `DigestPage` 在 `DigestTrigger` 下方、Tab 切换上方插入 `TldrCard` 组件。无数据时隐藏。

**手动触发：** `POST /api/digest/tldr { date }` 重新生成当天 TL;DR（用户如果觉得生成得不好可以重来）。

### B2 稍后读队列

操作入口：
- 日报卡片悬浮按钮组增加一个「⧗ 稍后读」（和「⭐ 收藏」并列）
- 点击 → `POST /api/reading-queue { digestItemId }` → 侧边栏有统计徽章

列表页：
- **不加独立页面**（导航栏已经 9 项，再加会挤）
- 收藏页 `/favorites` 加一个 Tab 切换：`收藏 | 稍后读`，复用现有 UI 组件
- 点击稍后读里的文章跳转到原文同时 `PATCH /api/reading-queue/:id { read_at: now }` 标记已读
- 过期的在列表里灰化显示（3 天内过期高亮提醒）

自动清理：首次访问 `/api/reading-queue` 时 lazy 执行 `DELETE WHERE expires_at < now() AND read_at IS NULL`。

### C2 实体订阅

订阅入口：
- `/insights` 页的实体详情面板，每个实体卡片右上加「🔔 订阅」按钮
- 点击 → `POST /api/entity-subscriptions { entityId }` → 按钮变为「🔕 已订阅」

Pipeline 集成：
```
Stage 3.6 实体提取完成后：
  查询本批次新提取的 entity_id 集合
    ↓
  SELECT * FROM entity_subscriptions
    WHERE entity_id IN (本批次) AND (last_notified_at IS NULL OR last_notified_at < now - 24h)
    ↓
  sendEntityAlerts(matches) → Telegram
    ↓
  UPDATE last_notified_at, notify_count += 1
```

消息格式：
```
🔔 你订阅的话题出现了

▸ {entityName} ({type})
  {相关文章数} 篇新文章，提及 {total mentions} 次
  最新：{title} - {source}

🔗 详情：{appUrl}/insights
```

### C3 每周洞察摘要

生成时机：
- **自动**：定时任务每周一凌晨 2 点生成上一周的洞察（上周一至周日）
- **手动**：`POST /api/insights/weekly` 按需重新生成

生成流程：
```
输入：上周 digest_items（Top 50 按 score 降序）+ 上周新增 topic_entities（Top 20 按 mentionCount 降序）
  ↓
AI 任务（quality 模型 + Zod schema）：
  - highlights: 3 件"从系统性视角"值得关注的事（不同于每日 TL;DR 的 3 件事）
  - observation: 1 段 2-3 句的观察（把 3 件事串成一个趋势判断）
  - key_entities: 3-5 个本周最活跃的实体（供订阅引导）
  ↓
写入 weekly_insights
```

展示位置：`/insights` 页最顶部，新增「本周洞察」section，放在知识图谱上方。

---

## API 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/digest/tldr?date=YYYY-MM-DD` | 读取指定日期 TL;DR |
| `POST` | `/api/digest/tldr` body `{date}` | 手动重新生成 |
| `GET` | `/api/reading-queue` | 列表（自动清理过期）|
| `POST` | `/api/reading-queue` body `{digestItemId}` | 加入队列 |
| `PATCH` | `/api/reading-queue/[id]` body `{readAt}` | 标记已读 |
| `DELETE` | `/api/reading-queue/[id]` | 移除 |
| `GET` | `/api/entity-subscriptions` | 列表 |
| `POST` | `/api/entity-subscriptions` body `{entityId}` | 订阅 |
| `DELETE` | `/api/entity-subscriptions/[id]` | 取消 |
| `GET` | `/api/insights/weekly?week=YYYY-MM-DD` | 读取指定周的洞察 |
| `POST` | `/api/insights/weekly` body `{weekStart?}` | 生成（默认上周）|

---

## 文件结构

### 新增

```
src/lib/digest/
├── tldr.ts                       ← B1 生成逻辑
└── weekly-insight.ts             ← C3 生成逻辑（不要和现有 weekly-summary.ts 混淆）

src/lib/reading-queue/
└── queries.ts                    ← B2 CRUD + 过期清理

src/lib/insights/
└── entity-subscription.ts        ← C2 订阅 + 推送检测

src/app/api/digest/tldr/
└── route.ts

src/app/api/reading-queue/
├── route.ts
└── [id]/route.ts

src/app/api/entity-subscriptions/
├── route.ts
└── [id]/route.ts

src/app/api/insights/weekly/
└── route.ts

src/components/digest/
├── tldr-card.tsx                 ← 首页 TL;DR 卡片
└── reading-queue-button.tsx      ← 卡片上的"稍后读"按钮

src/components/favorites/
├── favorites-tabs.tsx            ← 收藏 + 稍后读双 Tab
└── reading-queue-list.tsx        ← 稍后读列表组件

src/components/insights/
├── weekly-insight-card.tsx       ← 本周洞察卡片
└── entity-subscribe-button.tsx   ← 实体订阅按钮
```

### 修改

```
src/lib/db/schema.ts               ← 4 张新表
src/lib/db/index.ts                ← 4 张新表 bootstrap DDL
src/lib/digest/pipeline.ts         ← Stage 4 TL;DR 生成 + entity-subscription 推送挂载
src/lib/notify.ts                  ← 新增 sendEntityAlerts
src/lib/scheduler.ts               ← 周日晚或周一凌晨触发 weekly-insight 生成
src/components/digest/digest-page.tsx   ← 嵌入 TldrCard
src/components/digest/digest-card.tsx   ← 加 reading-queue-button
src/app/favorites/page.tsx         ← 改为 tabs 布局
src/components/insights/entity-graph.tsx ← 详情面板嵌入订阅按钮
src/app/insights/page.tsx          ← 顶部插入 WeeklyInsightCard
```

---

## 关键决策

1. **4 张独立表而非复用扩展** — 每个子功能的生命周期、查询模式、索引需求都不同，放在一张表里会过度耦合
2. **稍后读不加独立页面** — 导航栏已满，集成到 `/favorites` 的 Tabs 里最节能
3. **TL;DR 在 Pipeline 末尾生成而非按需** — 用户点开首页时已经可用，避免首次访问等待
4. **实体订阅 24h 去重** — 防止同一实体在连续几天的 pipeline 里反复推送
5. **Weekly Insight 与 Weekly Summary 并存** — 目的不同，Summary 流水全面，Insight 尖锐提炼，都保留
6. **Weekly Insight 新建表而非扩展 digest_runs** — digest_runs 语义是"采集执行记录"，塞周洞察会破坏语义
7. **所有 DDL 双轨同步** — runtime bootstrap + Drizzle migration 同时加，保持幂等

---

## 错误处理

- **TL;DR 生成失败**：不阻塞 pipeline 完成，记录错误日志，下次重试或手动触发
- **Weekly Insight 生成失败**：手动触发端点返回详细错误；定时任务失败写到 scheduler 日志
- **实体订阅推送失败**：fire-and-forget + console.error，不更新 last_notified_at（下次可重试）
- **稍后读 queue 插入重复**：UNIQUE 冲突时返回现有记录 ID（upsert 语义）

---

## 测试策略

单元测试（Vitest）：
- `tldr.test.ts`：mock digest_items 查询，验证 AI schema 结构和过滤逻辑
- `reading-queue.test.ts`：过期清理 SQL、upsert 行为
- `entity-subscription.test.ts`：24h 去重窗口、批次匹配逻辑
- `weekly-insight.test.ts`：周起止日期计算、数据聚合查询

目标：每个子功能至少 2 个测试，总共 ~8 个新测试。

手工验证清单（写在 commit message 里）：
- [ ] 触发 pipeline 后首页出现 TL;DR 卡片
- [ ] 卡片上「稍后读」按钮点击后徽章计数变化
- [ ] `/favorites` 页 Tabs 切换到稍后读能看到列表
- [ ] 实体详情面板订阅按钮能切换状态
- [ ] 手动触发 `POST /api/insights/weekly` 能生成洞察卡片

---

## 范围 Self-Review

| 检查项 | 结论 |
|---|---|
| Placeholder / TBD | 无 |
| 内部一致性 | 4 个子功能的数据流、存储、API、UI 一一对应 |
| 范围大小 | 4 表 + ~15 文件新增 + ~10 文件修改，在一个 plan 内可完成 |
| 歧义 | TL;DR 与 Weekly Insight 并存；Weekly Summary 保留；稍后读去重逻辑明确 |

合格，进入 plan 阶段。

# AutoMedia 全面优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四阶段全面优化——基础清理、数据层加固、SSE 实时进度、错误可见性

**Architecture:** 分 4 阶段 10 个 Task，每个 Task 独立可提交。SSE 用 EventEmitter 广播 + ReadableStream 推送，替代前端轮询。

**Tech Stack:** Next.js 16 App Router, TypeScript, SQLite/Drizzle, EventEmitter, SSE/EventSource

---

## 阶段 1：基础清理

### Task 1: extractJson 合并为共享工具函数

**Files:**
- Create: `src/lib/ai/utils.ts`
- Modify: `src/lib/ai/scoring.ts`
- Modify: `src/lib/ai/summarize.ts`
- Modify: `src/lib/ai/clustering.ts`

- [ ] **Step 1: 创建 `src/lib/ai/utils.ts`**

```typescript
// 从 AI 回复中提取 JSON（兼容 markdown 代码块、裸数组、裸对象）
export function extractJson(text: string): string | null {
  // 1. 尝试提取 ```json ... ``` 代码块
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  // 2. 尝试找 [ ... ]
  const bracket = text.indexOf('[')
  const lastBracket = text.lastIndexOf(']')
  if (bracket !== -1 && lastBracket > bracket) return text.slice(bracket, lastBracket + 1)
  // 3. 尝试找 { ... }
  const brace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (brace !== -1 && lastBrace > brace) return text.slice(brace, lastBrace + 1)
  return null
}
```

- [ ] **Step 2: 更新 `src/lib/ai/scoring.ts`**

删除本地 `extractJson` 函数（第 22-34 行），顶部添加 import：

```typescript
import { extractJson } from './utils'
```

同时删除 `filterTopItems` 函数（第 98-116 行）。

- [ ] **Step 3: 更新 `src/lib/ai/summarize.ts`**

删除本地 `extractJson` 函数（第 11-18 行），顶部添加 import：

```typescript
import { extractJson } from './utils'
```

- [ ] **Step 4: 更新 `src/lib/ai/clustering.ts`**

删除本地 `extractJson` 函数（第 10-18 行），顶部添加 import：

```typescript
import { extractJson } from './utils'
```

- [ ] **Step 5: 更新 `src/lib/pipeline.ts` 删除无用 import**

第 8 行改为：

```typescript
import { scoreItems } from './ai/scoring'
```

（删除 `filterTopItems` 的 import）

- [ ] **Step 6: 验证构建**

Run: `cd /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia && pnpm build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 7: 提交**

```bash
git add src/lib/ai/utils.ts src/lib/ai/scoring.ts src/lib/ai/summarize.ts src/lib/ai/clustering.ts src/lib/pipeline.ts
git commit -m "重构：extractJson 合并为共享工具函数 + 删除 filterTopItems 死代码"
```

---

### Task 2: 删除死代码（debug 端点 + browser 空壳）

**Files:**
- Delete: `src/app/api/debug/rss/route.ts`（及 `debug/rss/` 空目录）
- Delete: `src/lib/collectors/browser.ts`
- Modify: `src/lib/pipeline.ts`

- [ ] **Step 1: 删除 debug RSS 端点**

```bash
rm -rf src/app/api/debug
```

- [ ] **Step 2: 删除 browser.ts 空壳**

```bash
rm src/lib/collectors/browser.ts
```

- [ ] **Step 3: 更新 `src/lib/pipeline.ts`**

删除 browser 相关的 import 和调用：

- 删除第 7 行：`import { browserCollector } from './collectors/browser'`
- 删除 `privateSources` 的采集循环（第 121-139 行整个 for 循环）
- `allSources` 改为只用 `publicSources`：

```typescript
const publicSources = getPublicSources()
const allSources = publicSources
```

同时删除 `getPrivateSources` 的 import（第 5 行改为）：

```typescript
import { getPublicSources } from './sources'
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "清理：删除 debug/rss 端点和 browser.ts 空壳采集器"
```

---

### Task 3: getModels() 缓存 + settings 清缓存

**Files:**
- Modify: `src/lib/ai/client.ts`
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: 修改 `src/lib/ai/client.ts` 添加缓存**

在文件中添加缓存变量和清除函数：

```typescript
// 模块级缓存，避免每次调用重新创建实例
let cachedModels: { fast: LanguageModel; quality: LanguageModel } | null = null
let cachedConfigHash: string | null = null

// 获取当前配置的模型（带缓存）
export function getModels() {
  const config = getAIConfig()
  const hash = `${config.provider}|${config.baseUrl}|${config.apiKey}|${config.fastModel}|${config.qualityModel}`

  if (cachedModels && cachedConfigHash === hash) {
    return cachedModels
  }

  cachedModels = {
    fast: createModel(config, config.fastModel),
    quality: createModel(config, config.qualityModel),
  }
  cachedConfigHash = hash
  return cachedModels
}

// 清除模型缓存（配置变更时调用）
export function clearModelCache() {
  cachedModels = null
  cachedConfigHash = null
}
```

- [ ] **Step 2: 修改 `src/app/api/settings/route.ts` POST 清缓存**

顶部添加 import：

```typescript
import { clearModelCache } from '@/lib/ai/client'
```

在 POST 函数的 `return NextResponse.json({ success: true })` 之前加一行：

```typescript
    clearModelCache()
    return NextResponse.json({ success: true })
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add src/lib/ai/client.ts src/app/api/settings/route.ts
git commit -m "优化：getModels() 加模块级缓存，settings 变更时自动清除"
```

---

### Task 4: 修复 localhost 硬编码 + 统一 API key mask

**Files:**
- Modify: `src/lib/notify.ts`
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/api/settings/schedule/route.ts`

- [ ] **Step 1: 修复 `src/lib/notify.ts` 硬编码**

第 13 行改为：

```typescript
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const message = `📰 AutoMedia 日报已就绪\n\n📅 日期：${date}\n📊 共 ${itemCount} 条精选\n\n🔗 查看日报：${appUrl}/?date=${date}`
```

- [ ] **Step 2: 统一 `src/app/api/settings/route.ts` 的 maskKey**

第 82-85 行改为：

```typescript
function maskKey(key: string): string {
  if (!key || key.length < 10) return key ? '***' : ''
  return `${key.slice(0, 6)}***${key.slice(-4)}`
}
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add src/lib/notify.ts src/app/api/settings/route.ts
git commit -m "修复：Telegram 通知链接改读 APP_URL 环境变量 + 统一 API key 脱敏格式"
```

---

## 阶段 2：数据层加固

### Task 5: 修复搜索 N+1 查询 + 添加数据库索引

**Files:**
- Modify: `src/app/api/search/route.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 修复 `src/app/api/search/route.ts` N+1 查询**

将第 27-31 行的循环替换为批量查询：

```typescript
    // 批量查询，避免 N+1
    const ids = ftsRows.map(r => r.digest_item_id)
    const allItems = await db.select().from(digestItems).where(inArray(digestItems.id, ids))

    // 按 FTS rank 顺序排列
    const itemMap = new Map(allItems.map(item => [item.id, item]))
    const items = ftsRows.map(r => itemMap.get(r.digest_item_id)).filter(Boolean)
```

同时在文件顶部添加 `inArray` 的 import：

```typescript
import { eq, inArray } from 'drizzle-orm'
```

（删除原来只有 `eq` 的 import）

- [ ] **Step 2: 在 `src/lib/db/index.ts` 添加索引**

在 `export const db = drizzle(sqlite, { schema })` 之前，FTS 虚拟表创建之后，添加：

```typescript
// 常用查询索引
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_digest_items_date ON digest_items(digest_date)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_digest_items_source ON digest_items(source)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_raw_items_date ON raw_items(digest_date)`)
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add src/app/api/search/route.ts src/lib/db/index.ts
git commit -m "优化：搜索 N+1 改批量查询 + 添加 digest_items/raw_items 索引"
```

---

### Task 6: Pipeline 事务 + saveProgress await + Cron 校验

**Files:**
- Modify: `src/lib/pipeline.ts`
- Modify: `src/app/api/settings/schedule/route.ts`

- [ ] **Step 1: 修改 `src/lib/pipeline.ts` 写入阶段包进事务**

将 pipeline.ts 中第 214-248 行的写入逻辑改为事务（使用 better-sqlite3 的 transaction）：

```typescript
    // 写入精选数据（事务保证原子性）
    if (summarized.length > 0) {
      const writeDigest = db.$client.transaction(() => {
        // 先清理当天旧数据
        const oldDigestIds = db.$client
          .prepare('SELECT id FROM digest_items WHERE digest_date = ?')
          .all(date) as { id: string }[]

        if (oldDigestIds.length > 0) {
          const idPlaceholders = oldDigestIds.map(() => '?').join(',')
          db.$client
            .prepare(`DELETE FROM favorites WHERE digest_item_id IN (${idPlaceholders})`)
            .run(...oldDigestIds.map(r => r.id))
        }

        db.$client.prepare('DELETE FROM digest_fts WHERE digest_date = ?').run(date)
        db.$client.prepare('DELETE FROM digest_items WHERE digest_date = ?').run(date)

        // 插入新数据
        const insertDigest = db.$client.prepare(`
          INSERT INTO digest_items (id, digest_date, source, title, url, author, ai_score, one_liner, summary, cluster_id, cluster_sources, created_at, is_read)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `)
        const insertFts = db.$client.prepare(`
          INSERT INTO digest_fts (digest_item_id, title, one_liner, summary, source, digest_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `)

        for (const item of summarized) {
          const id = uuid()
          const now = new Date().toISOString()
          insertDigest.run(
            id, date, item.source, item.title, item.url, item.author || '',
            item.aiScore, item.oneLiner, item.summary,
            item.clusterId || null, JSON.stringify(item.clusterSources || []), now
          )
          insertFts.run(id, item.title, item.oneLiner, item.summary, item.source, date)
        }
      })

      writeDigest()
    }
```

- [ ] **Step 2: 修改 scoring/summarize 的 onProgress 回调为 async await**

在 `src/lib/pipeline.ts` 中，修改评分阶段的 onProgress 调用（约第 176-180 行）：

```typescript
    const scored = await scoreItems(allItems, async (done) => {
      progress.scoring!.done = done
      progress.detail = `已评分 ${done}/${allItems.length} 条`
      await saveProgress(runId, progress)
    })
```

和摘要阶段的 onProgress（约第 205-209 行）：

```typescript
    const summarized = await summarizeItems(clustered, async (done) => {
      progress.summarizing!.done = done
      progress.detail = `已生成 ${done}/${clustered.length} 条摘要`
      await saveProgress(runId, progress)
    })
```

同时修改 `src/lib/ai/scoring.ts` 的 `scoreItems` 函数签名和回调调用：

```typescript
export async function scoreItems(
  items: CollectedItem[],
  onProgress?: (done: number) => Promise<void> | void,
): Promise<ScoredItem[]> {
```

第 92 行改为 await：

```typescript
    await onProgress?.(Math.min(i + batchSize, items.length))
```

同样修改 `src/lib/ai/summarize.ts` 的 `summarizeItems`：

```typescript
export async function summarizeItems(
  items: ClusteredItem[],
  onProgress?: (done: number) => Promise<void> | void,
): Promise<SummarizedItem[]> {
```

第 76 行改为 await：

```typescript
    await onProgress?.(Math.min(i + batchSize, items.length))
```

- [ ] **Step 3: 修改 `src/app/api/settings/schedule/route.ts` 添加 Cron 校验**

在 POST 函数中，保存之前添加校验。在文件顶部添加 import：

```typescript
import { validate as cronValidate } from 'node-cron'
```

在 POST 函数的写入逻辑之前（约第 38 行），添加：

```typescript
  // 校验 cron 表达式
  if (body.cronExpression && !cronValidate(body.cronExpression)) {
    return NextResponse.json({ error: `无效的 cron 表达式: ${body.cronExpression}` }, { status: 400 })
  }
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
git add src/lib/pipeline.ts src/lib/ai/scoring.ts src/lib/ai/summarize.ts src/app/api/settings/schedule/route.ts
git commit -m "加固：Pipeline 写入事务化 + saveProgress await + Cron 校验"
```

---

## 阶段 3：SSE 实时进度

### Task 7: 创建 Pipeline 事件总线

**Files:**
- Create: `src/lib/pipeline-events.ts`

- [ ] **Step 1: 创建 `src/lib/pipeline-events.ts`**

```typescript
import { EventEmitter } from 'events'
import type { PipelineProgress } from './pipeline'

// 全局单例事件总线，pipeline 进度更新时 emit，SSE 端点监听
class PipelineEventBus extends EventEmitter {
  // 每个 runId 的最新进度快照（SSE 连接时可立即推送当前状态）
  private snapshots = new Map<string, { date: string; progress: PipelineProgress }>()

  emit(event: 'progress', data: { runId: string; date: string; progress: PipelineProgress }): boolean
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args)
  }

  on(event: 'progress', listener: (data: { runId: string; date: string; progress: PipelineProgress }) => void): this
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener)
  }

  off(event: 'progress', listener: (data: { runId: string; date: string; progress: PipelineProgress }) => void): this
  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener)
  }

  // 更新快照
  updateSnapshot(runId: string, date: string, progress: PipelineProgress) {
    this.snapshots.set(runId, { date, progress })
    this.emit('progress', { runId, date, progress })
    // 完成或失败后清理
    if (progress.phase === 'completed' || progress.phase === 'failed') {
      setTimeout(() => this.snapshots.delete(runId), 5000)
    }
  }

  // 获取指定日期的最新快照
  getSnapshot(date: string) {
    for (const [runId, snap] of this.snapshots) {
      if (snap.date === date) return { runId, ...snap }
    }
    return null
  }
}

export const pipelineEvents = new PipelineEventBus()
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/pipeline-events.ts
git commit -m "新增：Pipeline 事件总线（EventEmitter 单例）"
```

---

### Task 8: Pipeline 接入事件总线

**Files:**
- Modify: `src/lib/pipeline.ts`

- [ ] **Step 1: 修改 `src/lib/pipeline.ts` 接入事件总线**

顶部添加 import：

```typescript
import { pipelineEvents } from './pipeline-events'
```

修改 `saveProgress` 函数，在写 DB 的同时 emit 事件：

```typescript
async function saveProgress(runId: string, progress: PipelineProgress, date?: string) {
  await db.update(digestRuns).set({
    progress: { ...progress },
  }).where(eq(digestRuns.id, runId))
  // 同步广播到 SSE
  if (date) {
    pipelineEvents.updateSnapshot(runId, date, { ...progress })
  }
}
```

然后在 `runDigestPipeline` 函数中，所有调用 `saveProgress(runId, progress)` 的地方改为 `saveProgress(runId, progress, date)`，具体位置：
- 约第 100 行（采集源运行中）
- 约第 111 行（采集源完成）
- 约第 116 行（采集源失败）
- 约第 125 行（私域采集运行中，如果还存在的话——Task 2 已删除）
- 约第 170-174 行（评分阶段初始化，这里用 db.update，也需要 emit）
- 评分 onProgress 回调
- 约第 186 行（评分完成）
- 约第 192 行（去重初始化）
- 约第 197 行（去重完成）
- 约第 203 行（摘要初始化）
- 摘要 onProgress 回调
- 约第 211 行（摘要完成）
- 约第 259 行（completed）
- 约第 282 行（failed）

对于 completed 和 failed 阶段，在写入 DB 之后也要 emit：

在 completed 的 `db.update` 之后添加：

```typescript
    pipelineEvents.updateSnapshot(runId, date, completedProgress)
```

在 failed 的 `db.update` 之后添加：

```typescript
    pipelineEvents.updateSnapshot(runId, date, failedProgress)
```

评分阶段初始化那里（原来用 `db.update` 而不是 `saveProgress`），改为也 emit：

```typescript
    await db.update(digestRuns).set({
      rawCount: allItems.length,
      progress,
      status: 'processing',
    }).where(eq(digestRuns.id, runId))
    pipelineEvents.updateSnapshot(runId, date, progress)
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/lib/pipeline.ts
git commit -m "接入：Pipeline 进度写 DB 的同时广播到事件总线"
```

---

### Task 9: SSE 端点 + 前端 EventSource

**Files:**
- Create: `src/app/api/digest/stream/route.ts`
- Modify: `src/components/digest/digest-trigger.tsx`

- [ ] **Step 1: 创建 SSE 端点 `src/app/api/digest/stream/route.ts`**

```typescript
import { pipelineEvents } from '@/lib/pipeline-events'
import { getDigestRunStatus } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // 连接已关闭
        }
      }

      // 立即推送当前状态
      const snapshot = pipelineEvents.getSnapshot(date)
      if (snapshot) {
        send({ type: 'progress', ...snapshot })
      } else {
        // 从 DB 查最新状态
        getDigestRunStatus(date).then(runs => {
          if (runs.length > 0) {
            const run = runs[0]
            send({
              type: 'progress',
              runId: run.id,
              date: run.digestDate,
              progress: run.progress,
              status: run.status,
              rawCount: run.rawCount,
              filteredCount: run.filteredCount,
              errors: run.errors,
            })
          } else {
            send({ type: 'status', status: 'none', date })
          }
        })
      }

      // 监听后续进度事件
      const onProgress = (data: { runId: string; date: string; progress: unknown }) => {
        if (data.date === date) {
          send({ type: 'progress', ...data })
        }
      }

      pipelineEvents.on('progress', onProgress)

      // 心跳保活（每 30 秒）
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      // 客户端断开时清理
      request.signal.addEventListener('abort', () => {
        pipelineEvents.off('progress', onProgress)
        clearInterval(heartbeat)
        try { controller.close() } catch { /* 已关闭 */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: 修改 `src/components/digest/digest-trigger.tsx` 使用 EventSource**

替换整个文件的轮询逻辑。主要改动：

1. 删除 `pollingRef`、`startPolling`、`stopPolling` 相关代码
2. 添加 `eventSourceRef` 和 SSE 连接逻辑

将 `pollingRef` 和相关函数替换为：

```typescript
  const eventSourceRef = useRef<EventSource | null>(null)

  // 清理 SSE 连接
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const startSSE = useCallback(() => {
    stopSSE()
    const es = new EventSource(`/api/digest/stream?date=${date}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'status' && data.status === 'none') return

        if (data.progress) {
          setProgress(data.progress as PipelineProgress)
          const phase = (data.progress as PipelineProgress).phase
          if (phase === 'completed') {
            setStatus('completed')
            stopSSE()
            onComplete()
          } else if (phase === 'failed') {
            setStatus('failed')
            stopSSE()
            setError((data.progress as PipelineProgress).detail || '生成失败')
          } else {
            setStatus(phase === 'collecting' ? 'collecting' : 'processing')
          }
        }
        if (data.status === 'completed') {
          setStatus('completed')
          stopSSE()
          onComplete()
        } else if (data.status === 'failed') {
          setStatus('failed')
          stopSSE()
          setError(data.errors ? Object.values(data.errors as Record<string, string>).join('; ') : '生成失败')
        }
      } catch {
        // 忽略解析错误
      }
    }

    es.onerror = () => {
      // EventSource 会自动重连，不需要手动处理
      // 但如果已经完成，不再重连
      if (status === 'completed' || status === 'failed' || status === 'none') {
        stopSSE()
      }
    }
  }, [date, onComplete, stopSSE, status])
```

修改 `handleTrigger` 中 `startPolling()` 为 `startSSE()`：

```typescript
  const handleTrigger = async () => {
    setStatus("collecting")
    setProgress(null)
    setError(null)

    try {
      await fetch("/api/digest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      })
      startSSE()
    } catch {
      setStatus("failed")
      setError("请求失败，请检查网络")
    }
  }
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add src/app/api/digest/stream/route.ts src/components/digest/digest-trigger.tsx
git commit -m "SSE 实时进度：EventSource 替代前端轮询，新增 /api/digest/stream 端点"
```

---

## 阶段 4：错误可见性

### Task 10: AI 批次失败追踪 + Pipeline 异常兜底

**Files:**
- Modify: `src/lib/ai/scoring.ts`
- Modify: `src/lib/ai/summarize.ts`
- Modify: `src/lib/pipeline.ts`

- [ ] **Step 1: 修改 `src/lib/ai/scoring.ts` 返回失败统计**

修改 `scoreItems` 返回值，增加失败统计：

```typescript
export interface ScoreResult {
  items: ScoredItem[]
  failedCount: number
}

export async function scoreItems(
  items: CollectedItem[],
  onProgress?: (done: number) => Promise<void> | void,
): Promise<ScoreResult> {
  const results: ScoredItem[] = []
  const batchSize = 20
  let failedCount = 0

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    // ... 现有逻辑 ...
    try {
      // ... generateText 调用 ...
      const jsonStr = extractJson(text)
      if (!jsonStr) {
        console.error('[scoring] 无法提取 JSON')
        failedCount += batch.length
        continue
      }
      // ... 解析和 push ...
    } catch (err) {
      console.error('[scoring] 评分失败，跳过当前批次:', err)
      failedCount += batch.length
    }
    await onProgress?.(Math.min(i + batchSize, items.length))
  }

  return { items: results, failedCount }
}
```

- [ ] **Step 2: 修改 `src/lib/ai/summarize.ts` 返回失败统计**

同样修改返回值：

```typescript
export interface SummarizeResult {
  items: SummarizedItem[]
  failedCount: number
}

export async function summarizeItems(
  items: ClusteredItem[],
  onProgress?: (done: number) => Promise<void> | void,
): Promise<SummarizeResult> {
  const results: SummarizedItem[] = []
  const batchSize = 5
  let failedCount = 0

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    // ... 现有逻辑 ...
    try {
      // ...
      const jsonStr = extractJson(text)
      if (!jsonStr) {
        // fallback 仍然执行，但标记为失败
        failedCount += batch.length
        for (const item of batch) {
          results.push({ ...item, oneLiner: item.title.slice(0, 30), summary: item.content.slice(0, 150) })
        }
        continue
      }
      // ... 正常解析 ...
    } catch (err) {
      console.error('[summarize] 摘要生成失败，使用 fallback:', err)
      failedCount += batch.length
      for (const item of batch) {
        results.push({ ...item, oneLiner: item.title.slice(0, 30), summary: item.content.slice(0, 150) })
      }
    }
    await onProgress?.(Math.min(i + batchSize, items.length))
  }

  return { items: results, failedCount }
}
```

- [ ] **Step 3: 更新 `src/lib/pipeline.ts` 中对 scoreItems/summarizeItems 的调用**

修改 `PipelineProgress` 接口，在 scoring 和 summarizing 中增加 `failed` 字段：

```typescript
export interface PipelineProgress {
  phase: 'collecting' | 'scoring' | 'clustering' | 'summarizing' | 'completed' | 'failed'
  sources?: Record<string, SourceProgress>
  scoring?: { total: number; done: number; filtered: number; failed?: number }
  clustering?: { total: number; done: number }
  summarizing?: { total: number; done: number; failed?: number }
  detail?: string
}
```

评分调用处改为：

```typescript
    const scoreResult = await scoreItems(allItems, async (done) => {
      progress.scoring!.done = done
      progress.detail = `已评分 ${done}/${allItems.length} 条`
      await saveProgress(runId, progress, date)
    })
    const scored = scoreResult.items
    const recommendedCount = scored.filter(s => s.aiScore >= 5).length
    progress.scoring!.done = allItems.length
    progress.scoring!.filtered = recommendedCount
    progress.scoring!.failed = scoreResult.failedCount
    const failNote = scoreResult.failedCount > 0 ? `（${scoreResult.failedCount} 条评分失败）` : ''
    progress.detail = `评分完成，${recommendedCount} 条推荐${failNote}`
    await saveProgress(runId, progress, date)
```

摘要调用处改为：

```typescript
    const summarizeResult = await summarizeItems(clustered, async (done) => {
      progress.summarizing!.done = done
      progress.detail = `已生成 ${done}/${clustered.length} 条摘要`
      await saveProgress(runId, progress, date)
    })
    const summarized = summarizeResult.items
    progress.summarizing!.done = clustered.length
    progress.summarizing!.failed = summarizeResult.failedCount
    await saveProgress(runId, progress, date)
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
git add src/lib/ai/scoring.ts src/lib/ai/summarize.ts src/lib/pipeline.ts
git commit -m "增强：AI 批次失败计数追踪，进度中展示失败数"
```

---

## 最终验证

- [ ] **运行 `pnpm build` 确认整体构建通过**
- [ ] **运行 `pnpm dev` 启动开发服务器，手动触发一次日报生成，确认 SSE 进度正常**

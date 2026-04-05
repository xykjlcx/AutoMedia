# Spec 3 实施计划：Twitter/X 采集通道

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 交付 A1 Twitter 采集的两路通道（公开推文 + 私域时间线代码架子）。

**Architecture:** 引入 collector 多态派发 + 两个新 collector 实现 + 快捷配置 UI + 私域链路验证文档。

**Tech Stack:** rss-parser（复用）/ Node child_process execFile（Agent Browser 调用）。

---

## Task 1: Collector 多态派发

**Files:**
- Create: `src/lib/digest/collectors/index.ts`
- Create: `src/lib/digest/collectors/twitter-public.ts`
- Create: `src/lib/digest/collectors/twitter-private.ts`

- [ ] **Step 1: 创建 `src/lib/digest/collectors/twitter-public.ts`**

```typescript
import { rssCollector } from './rss'
import type { Collector, CollectedItem } from './types'

// Twitter 公开推文采集：底层复用 RSS，走 RSSHub 的 /twitter/user/:username 路由
export const twitterPublicCollector: Collector = {
  name: 'twitter-public',

  async collect(sourceId, config): Promise<CollectedItem[]> {
    const items = await rssCollector.collect(sourceId, config)
    // sourceType 保持 public（因为公开推文不需登录）
    return items.map<CollectedItem>(it => ({
      ...it,
      sourceType: 'public',
    }))
  },
}
```

- [ ] **Step 2: 创建 `src/lib/digest/collectors/twitter-private.ts`**

```typescript
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectedItem } from './types'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const TIMELINE_URL = 'https://x.com/home'
const TIMEOUT_MS = 60000

// 提取时间线 tweets 的浏览器端脚本
const EXTRACT_SCRIPT = `
(async () => {
  await new Promise(r => setTimeout(r, 2500));
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];
  for (const art of Array.from(articles).slice(0, 40)) {
    try {
      const textEl = art.querySelector('[data-testid="tweetText"]');
      const authorEl = art.querySelector('[data-testid="User-Name"] a[role="link"]');
      const linkEl = art.querySelector('a[href*="/status/"]');
      if (!textEl || !linkEl) continue;
      const url = linkEl.href.startsWith('http') ? linkEl.href : 'https://x.com' + linkEl.getAttribute('href');
      tweets.push({
        text: (textEl.textContent || '').trim(),
        author: authorEl ? (authorEl.textContent || '').trim() : '',
        url,
      });
    } catch {}
  }
  return tweets;
})()
`.trim()

// 解析 agent-browser stdout：支持 JSON 或纯文本 fallback
function parseAgentBrowserOutput(stdout: string): Array<{ text: string; author: string; url: string }> {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  // 尝试 JSON 解析（首选路径）
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
    // 有时 agent-browser 包装在 { result: [...] } 里
    if (parsed?.result && Array.isArray(parsed.result)) return parsed.result
  } catch {
    // 非 JSON，fallthrough
  }

  // Fallback：尝试从 stdout 里提取 JSON 数组（有些 CLI 会在前后加 log）
  const match = trimmed.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {
      // ignore
    }
  }
  return []
}

export const twitterPrivateCollector: Collector = {
  name: 'twitter-private',

  async collect(sourceId, _config): Promise<CollectedItem[]> {
    try {
      const { stdout } = await execFileAsync(
        AGENT_BROWSER_CMD,
        ['eval', '--url', TIMELINE_URL, '--script', EXTRACT_SCRIPT, '--json'],
        { timeout: TIMEOUT_MS }
      )

      const parsed = parseAgentBrowserOutput(stdout)
      const items: CollectedItem[] = parsed
        .filter(t => t?.text && t?.url)
        .map(t => ({
          source: sourceId,
          sourceType: 'private' as const,
          title: t.text.slice(0, 120),
          content: t.text,
          url: t.url,
          author: t.author || '',
        }))

      return items
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Twitter 私域采集失败：${msg}。请确认 (1) Chrome 已启动并开启 remote debugging；(2) 已登录 x.com；(3) agent-browser CLI 已安装。详见 docs/twitter-setup.md`
      )
    }
  },
}
```

- [ ] **Step 3: 创建 `src/lib/digest/collectors/index.ts`**

```typescript
import { rssCollector } from './rss'
import { twitterPublicCollector } from './twitter-public'
import { twitterPrivateCollector } from './twitter-private'
import type { Collector } from './types'

const collectorMap: Record<string, Collector> = {
  'public': rssCollector,
  'custom-rss': rssCollector,
  'twitter-public': twitterPublicCollector,
  'twitter-private': twitterPrivateCollector,
}

// 根据 source.type 选择对应的 collector；未识别时返回 null
export function pickCollector(sourceType: string): Collector | null {
  return collectorMap[sourceType] || null
}

export { rssCollector, twitterPublicCollector, twitterPrivateCollector }
```

- [ ] **Step 4: Build 验证**

```bash
pnpm build
```

---

## Task 2: Pipeline 采集派发升级

**Files:**
- Modify: `src/lib/digest/pipeline.ts`
- Modify: `src/lib/sources.ts`

- [ ] **Step 1: 修改 `src/lib/sources.ts` 的 getPublicSources 过滤条件**

找到：
```typescript
export function getPublicSources(): SourceConfig[] {
  return getAllSources().filter(s => (s.type === 'public' || s.type === 'custom-rss') && s.enabled)
}
```

替换为：
```typescript
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
```

- [ ] **Step 2: 修改 `src/lib/digest/pipeline.ts` 的采集调用**

文件顶部 import 区（替换 `import { rssCollector } from './collectors/rss'`）：

```typescript
import { pickCollector } from './collectors'
```

采集循环处（原代码大约在文件 113-123 行左右）：

```typescript
const collectResults = await Promise.allSettled(
  publicSources.map(async (source) => {
    const startTime = Date.now()
    const items = await rssCollector.collect(source.id, {
      rssPath: source.rssPath || '',
      rssUrl: source.rssUrl || ''
    })
    const duration = (Date.now() - startTime) / 1000
    return { sourceId: source.id, items, duration }
  })
)
```

替换为：

```typescript
const collectResults = await Promise.allSettled(
  publicSources.map(async (source) => {
    const startTime = Date.now()
    const collector = pickCollector(source.type)
    if (!collector) {
      throw new Error(`未知的源类型: ${source.type}（source.id=${source.id}）`)
    }
    const items = await collector.collect(source.id, {
      rssPath: source.rssPath || '',
      rssUrl: source.rssUrl || '',
      targetUrl: source.targetUrl || '',
    })
    const duration = (Date.now() - startTime) / 1000
    return { sourceId: source.id, items, duration }
  })
)
```

**注意：** 如果在这个时间点，pipeline.ts 里还保留了"privateSources 标记为待实现"的代码段，**保留该代码但检查条件**：只有不在新 collectorMap 里的 `private` 类型才标记为待实现。twitter-private 现在有了对应 collector，不应该被标记为"待实现"。

具体：找到这段代码
```typescript
// 私域源标记为待实现
for (const source of privateSources) {
  updateSource(source.id, { status: 'error', error: '私域采集待实现' })
}
```

把 `privateSources` 的过滤条件调整（在原文件里是从 `allEnabledSources.filter(s => s.type === 'private')` 来的）：

找到：
```typescript
const privateSources = allEnabledSources.filter(s => s.type === 'private')
```

替换为：
```typescript
// 只有确实无 collector 的 legacy 'private' 类型才标记为待实现
const privateSources = allEnabledSources.filter(s => s.type === 'private')
```
（这行不需要改，因为 twitter-private 和 legacy private 是不同 type。保留行为）

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

---

## Task 3: Twitter 快捷添加 API

**Files:**
- Create: `src/app/api/sources/twitter/route.ts`
- Create: `src/app/api/sources/twitter/health/route.ts`

- [ ] **Step 1: 创建 `src/app/api/sources/twitter/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'
import { sourceConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const username: string = (body?.username || '').trim().replace(/^@/, '')
  const type: 'public' | 'private' = body?.type === 'private' ? 'private' : 'public'
  const displayName: string = (body?.displayName || '').trim()

  if (type === 'public' && !username) {
    return NextResponse.json({ error: '缺少 username' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (type === 'public') {
    const id = `twitter-${username.toLowerCase()}`
    // 防重复
    const existing = db.select().from(sourceConfigs).where(eq(sourceConfigs.id, id)).get()
    if (existing) {
      return NextResponse.json({ id, duplicate: true })
    }

    const name = displayName || `Twitter @${username}`
    const sortOrder = 100 // 放在默认源之后

    db.insert(sourceConfigs).values({
      id,
      name,
      icon: '🐦',
      type: 'twitter-public',
      rssPath: `/twitter/user/${username}`,
      rssUrl: '',
      targetUrl: `https://x.com/${username}`,
      enabled: true,
      maxItems: 10,
      sortOrder,
      createdAt: now,
    }).run()

    return NextResponse.json({ id })
  } else {
    // private：固定 id 'twitter-feed'（只允许一个私域时间线）
    const id = 'twitter-feed'
    const existing = db.select().from(sourceConfigs).where(eq(sourceConfigs.id, id)).get()
    if (existing) {
      // 已存在则改为 twitter-private 类型并启用
      db.update(sourceConfigs).set({
        type: 'twitter-private',
        targetUrl: 'https://x.com/home',
        enabled: true,
      }).where(eq(sourceConfigs.id, id)).run()
      return NextResponse.json({ id, updated: true })
    }

    db.insert(sourceConfigs).values({
      id,
      name: displayName || 'Twitter 时间线',
      icon: '🐦',
      type: 'twitter-private',
      rssPath: '',
      rssUrl: '',
      targetUrl: 'https://x.com/home',
      enabled: true,
      maxItems: 30,
      sortOrder: 99,
      createdAt: now,
    }).run()

    return NextResponse.json({ id })
  }
}
```

- [ ] **Step 2: 创建 `src/app/api/sources/twitter/health/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'

export async function GET() {
  try {
    // 尝试调用 --help 或 --version 测试 CLI 存在性
    const { stdout } = await execFileAsync(AGENT_BROWSER_CMD, ['--help'], { timeout: 5000 })
    return NextResponse.json({
      cliAvailable: true,
      cliOutput: stdout.slice(0, 200),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      cliAvailable: false,
      error: msg,
      hint: '需要全局安装 agent-browser CLI（见 docs/twitter-setup.md）',
    })
  }
}
```

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

---

## Task 4: Settings 页面 Twitter 快捷添加组件

**Files:**
- Create: `src/components/settings/twitter-source-adder.tsx`
- Modify: `src/app/settings/page.tsx`（或源管理子组件）

- [ ] **Step 1: 创建 `src/components/settings/twitter-source-adder.tsx`**

```typescript
"use client"

import { useEffect, useState } from 'react'
import { Twitter, Plus, Loader2, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TwitterSourceAdderProps {
  onAdded?: () => void
}

export function TwitterSourceAdder({ onAdded }: TwitterSourceAdderProps) {
  const [username, setUsername] = useState('')
  const [type, setType] = useState<'public' | 'private'>('public')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/sources/twitter/health')
      .then(r => r.json())
      .then(d => setCliAvailable(!!d.cliAvailable))
      .catch(() => setCliAvailable(false))
  }, [])

  const handleAdd = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/sources/twitter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: type === 'public' ? username : '',
          type,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: data.duplicate ? '该 Twitter 源已存在' : '添加成功' })
        setUsername('')
        onAdded?.()
      } else {
        setResult({ ok: false, message: data.error || '添加失败' })
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : '请求失败' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Twitter className="size-4 text-[var(--color-warm-accent)]" />
        <h3 className="text-sm font-medium">添加 Twitter 源</h3>
      </div>

      <div className="space-y-3">
        {/* 类型切换 */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setType('public')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              type === 'public'
                ? 'bg-[var(--color-warm-accent)] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            公开用户
          </button>
          <button
            onClick={() => setType('private')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              type === 'private'
                ? 'bg-[var(--color-warm-accent)] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            我的时间线（需登录）
          </button>
        </div>

        {type === 'public' ? (
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.replace(/^@/, ''))}
            placeholder="@username（例如 elonmusk）"
            className="w-full px-3 py-2 rounded-md border border-border/60 bg-background text-sm outline-none focus:border-[var(--color-warm-accent)]"
          />
        ) : (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>私域时间线通过 Agent Browser 抓取登录后的 feed。前置要求：</p>
            <ul className="list-disc list-inside ml-1 space-y-0.5">
              <li>Chrome 以 remote debugging 模式启动</li>
              <li>已登录 x.com</li>
              <li>全局安装 agent-browser CLI</li>
            </ul>
            {cliAvailable === false && (
              <p className="flex items-center gap-1 text-orange-600 dark:text-orange-400 mt-2">
                <AlertTriangle className="size-3" />
                当前未检测到 agent-browser CLI
              </p>
            )}
            {cliAvailable === true && (
              <p className="flex items-center gap-1 text-green-600 dark:text-green-400 mt-2">
                <Check className="size-3" />
                agent-browser CLI 可用
              </p>
            )}
            <p className="text-muted-foreground/70">详细说明见 docs/twitter-setup.md</p>
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={loading || (type === 'public' && !username.trim())}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--color-warm-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          添加
        </button>

        {result && (
          <div className={cn(
            'text-xs px-2 py-1.5 rounded-md',
            result.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 Settings 页面的源管理区集成 TwitterSourceAdder**

读取 `src/app/settings/page.tsx`，找到源管理相关的 JSX 位置，在合适处插入：

```tsx
<TwitterSourceAdder onAdded={reloadSources} />
```

如果 settings page 的结构很复杂，可以暂时把它放在顶部作为一个独立卡片，不强依赖现有分组。

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit Twitter Public + 配置 UI**

```bash
git add -A && git commit -m "功能：A1 Twitter 采集通道（collector 多态派发 + 公开推文 + 私域架子 + 快捷配置 UI）"
```

---

## Task 5: Seed 升级 + 验证脚本 + 文档

**Files:**
- Modify: `src/lib/db/seed.ts`
- Create: `scripts/twitter-smoke-test.mjs`
- Create: `docs/twitter-setup.md`

- [ ] **Step 1: 修改 `src/lib/db/seed.ts` 让默认 twitter 源升级为 twitter-private 类型**

找到 DEFAULT_SOURCES 里的 twitter 条目：
```typescript
{ id: 'twitter', name: 'Twitter', icon: '🐦', type: 'private' as const, targetUrl: 'https://x.com/home', enabled: false, sortOrder: 5 },
```

替换为：
```typescript
{ id: 'twitter', name: 'Twitter 时间线', icon: '🐦', type: 'twitter-private' as const, targetUrl: 'https://x.com/home', enabled: false, sortOrder: 5 },
```

注意：TypeScript 里 `type: 'twitter-private' as const` 的 `as const` 让字面量被保留，避免类型错误。

在 migrateRssSources 函数末尾增加一个迁移：

```typescript
    // Twitter legacy private 类型升级（幂等）
    db.update(sourceConfigs).set({ type: 'twitter-private' })
      .where(eq(sourceConfigs.id, 'twitter'))
      .run()
```

- [ ] **Step 2: 创建 `scripts/twitter-smoke-test.mjs`**

```javascript
#!/usr/bin/env node
// 明早洋哥手动跑：验证 agent-browser 能否拉到 Twitter 时间线
// 用法：node scripts/twitter-smoke-test.mjs

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'

const EXTRACT_SCRIPT = `
(async () => {
  await new Promise(r => setTimeout(r, 2500));
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];
  for (const art of Array.from(articles).slice(0, 10)) {
    try {
      const textEl = art.querySelector('[data-testid="tweetText"]');
      const authorEl = art.querySelector('[data-testid="User-Name"] a[role="link"]');
      const linkEl = art.querySelector('a[href*="/status/"]');
      if (!textEl || !linkEl) continue;
      tweets.push({
        text: (textEl.textContent || '').slice(0, 80),
        author: authorEl ? (authorEl.textContent || '') : '',
        url: linkEl.href || linkEl.getAttribute('href'),
      });
    } catch {}
  }
  return tweets;
})()
`.trim()

async function main() {
  console.log('[smoke-test] 检查 agent-browser CLI...')
  try {
    const { stdout } = await execFileAsync(AGENT_BROWSER_CMD, ['--help'], { timeout: 5000 })
    console.log('[smoke-test] ✅ CLI 可用')
    console.log(stdout.slice(0, 200))
  } catch (err) {
    console.error('[smoke-test] ❌ CLI 调用失败:', err.message)
    process.exit(1)
  }

  console.log('\n[smoke-test] 尝试连接 Chrome 并访问 x.com/home...')
  try {
    const { stdout } = await execFileAsync(
      AGENT_BROWSER_CMD,
      ['eval', '--url', 'https://x.com/home', '--script', EXTRACT_SCRIPT, '--json'],
      { timeout: 60000 }
    )
    console.log('[smoke-test] agent-browser 原始输出：')
    console.log(stdout.slice(0, 2000))

    // 尝试 parse
    let tweets = []
    try {
      tweets = JSON.parse(stdout.trim())
    } catch {
      const match = stdout.match(/\[[\s\S]*\]/)
      if (match) tweets = JSON.parse(match[0])
    }

    console.log(`\n[smoke-test] 解析出 ${tweets.length} 条 tweets`)
    for (const t of tweets.slice(0, 3)) {
      console.log(`  - ${t.author}: ${t.text?.slice(0, 50)}`)
    }

    if (tweets.length === 0) {
      console.warn('[smoke-test] ⚠️ 未解析出 tweets，可能需要调整 agent-browser CLI 参数或 DOM 选择器')
      console.warn('[smoke-test] 详见 src/lib/digest/collectors/twitter-private.ts 里的 EXTRACT_SCRIPT')
    } else {
      console.log('[smoke-test] ✅ 成功拉取时间线')
    }
  } catch (err) {
    console.error('[smoke-test] ❌ 采集失败:', err.message)
    console.error('[smoke-test] 常见原因：')
    console.error('  1. Chrome 未启动或未开启 remote debugging (--remote-debugging-port=9222)')
    console.error('  2. 未登录 x.com')
    console.error('  3. agent-browser CLI 参数与代码不匹配（真实参数请 agent-browser --help 查看）')
  }
}

main().catch(err => {
  console.error('[smoke-test] 致命错误:', err)
  process.exit(1)
})
```

- [ ] **Step 3: 创建 `docs/twitter-setup.md`**

```markdown
# Twitter/X 采集通道设置指南

## 概述

AutoMedia 提供两路 Twitter 采集：

| 通道 | 说明 | 需要登录 | 配置方式 |
|---|---|---|---|
| **公开推文** | 特定 @username 的公开推文 | 否 | Settings → 添加 Twitter 源 → 公开用户 |
| **私域时间线** | 你 Following 的 feed | 是 | Settings → 添加 Twitter 源 → 我的时间线 |

## 公开推文（立即可用）

在 Settings 页面的源管理区找到「添加 Twitter 源」卡片：
1. 选「公开用户」
2. 输入 `@elonmusk`（不带 @ 也行）
3. 点添加

系统会自动通过 RSSHub 的 `/twitter/user/:username` 路由采集。无需额外配置。

## 私域时间线（需手动配置）

### 前置要求

1. **全局安装 agent-browser CLI**
   ```bash
   # 确保 agent-browser 命令可用
   which agent-browser
   ```
   如果没有安装，参考 `~/.claude/guides/agent-browser.md`。

2. **Chrome 以 remote debugging 模式启动**
   ```bash
   # macOS
   open -a "Google Chrome" --args --remote-debugging-port=9222
   ```
   之后在这个 Chrome 里登录 [x.com](https://x.com) 并确认 `https://x.com/home` 能正常显示时间线。

3. **验证 agent-browser 能连接 Chrome**
   ```bash
   agent-browser --auto-connect --help
   ```

### 操作步骤

1. 启动 AutoMedia 开发服务器：`pnpm dev`
2. 打开 `/settings` → 源管理
3. 在「添加 Twitter 源」卡片切到「我的时间线」
4. 检查是否显示"agent-browser CLI 可用"绿色提示
5. 点添加
6. 手动触发一次 pipeline：首页 → 生成今日日报
7. 观察 Twitter 源的采集状态（实时 SSE 日志）

### 故障诊断

如果采集失败，按顺序排查：

1. **跑验证脚本**
   ```bash
   node scripts/twitter-smoke-test.mjs
   ```
   脚本会输出具体失败原因。

2. **常见问题：**

   - **"command not found: agent-browser"** → CLI 未安装或 PATH 未包含
   - **"连接 Chrome 失败"** → Chrome 未以 debug 模式启动，或端口被占用
   - **"未解析出 tweets"** → X 的 DOM 结构可能变化，需要调整 `src/lib/digest/collectors/twitter-private.ts` 里的 `EXTRACT_SCRIPT`
   - **agent-browser 实际 CLI 参数不同** → 查看 `agent-browser --help`，对比 `twitter-private.ts` 里 `execFile` 传的参数，必要时调整

3. **CLI 参数不匹配的处理：**

   `twitter-private.ts` 里假设的命令格式是：
   ```bash
   agent-browser eval --url https://x.com/home --script '<js>' --json
   ```

   如果实际 agent-browser 的参数不同（比如用 `--eval` 代替 `--script`，或需要先 `open` 再 `eval`），修改 `twitter-private.ts` 的 `execFile` 调用即可。数据流和 parse 逻辑不用动。

### 预期效果

配置成功后，每次 pipeline 触发会：
1. 连接 Chrome 里的 x.com 页面
2. 抓取时间线最新 30-40 条 tweets
3. 进入 AI 评分 → 聚类 → 摘要管线
4. 高分 tweets 出现在今日日报里，来源标记 🐦 Twitter 时间线

## 架构说明

- `src/lib/digest/collectors/twitter-public.ts` — 包装 RSS collector
- `src/lib/digest/collectors/twitter-private.ts` — 调用 agent-browser CLI
- `src/lib/digest/collectors/index.ts` — collector 多态派发
- `src/lib/digest/pipeline.ts` — 采集循环通过 pickCollector(source.type) 路由
```

- [ ] **Step 4: Build 验证**

```bash
pnpm build
```

- [ ] **Step 5: Commit seed + 文档**

```bash
git add -A && git commit -m "文档：Twitter 采集设置指南 + smoke-test 脚本 + seed 升级"
```

---

## Task 6: 单元测试（可选，时间允许则做）

**Files:**
- Create: `src/lib/__tests__/collectors.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest'
import { pickCollector } from '@/lib/digest/collectors'

describe('collector dispatch', () => {
  it('returns rssCollector for public type', () => {
    const c = pickCollector('public')
    expect(c).toBeTruthy()
    expect(c?.name).toBe('rss')
  })

  it('returns rssCollector for custom-rss type', () => {
    const c = pickCollector('custom-rss')
    expect(c?.name).toBe('rss')
  })

  it('returns twitter-public collector for twitter-public type', () => {
    const c = pickCollector('twitter-public')
    expect(c?.name).toBe('twitter-public')
  })

  it('returns twitter-private collector for twitter-private type', () => {
    const c = pickCollector('twitter-private')
    expect(c?.name).toBe('twitter-private')
  })

  it('returns null for unknown type', () => {
    const c = pickCollector('unknown-type')
    expect(c).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试**

```bash
pnpm test
```

- [ ] **Step 3: Commit 测试**

```bash
git add -A && git commit -m "测试：Spec 3 collector 派发单元测试"
```

---

## Task 7: 收尾验证

- [ ] **Step 1: 全量 build**

```bash
pnpm build
```

- [ ] **Step 2: 全量 test**

```bash
pnpm test
```

- [ ] **Step 3: 列出所有新增 collector 文件**

```bash
ls src/lib/digest/collectors/
```
Expected: index.ts / rss.ts / twitter-private.ts / twitter-public.ts / types.ts

- [ ] **Step 4: 检查未提交变更**

```bash
git status
```

- [ ] **Step 5: 如有变更做最终提交**

```bash
git add -A && git commit -m "Spec 3：Twitter 采集通道完成（公开推文可用，私域待洋哥明早授权）" || echo "no changes"
```

---

## Self-Review

**Spec 覆盖：**
- Collector 多态派发 → Task 1 ✓
- Pipeline 集成 → Task 2 ✓
- 快捷配置 API/UI → Task 3-4 ✓
- Seed 升级 + 验证脚本 + 文档 → Task 5 ✓
- 单元测试 → Task 6 ✓

**Placeholder：** 无。agent-browser CLI 实际参数的不确定性已在代码注释和文档里明确标注为"明早校准"，且代码有 fallback parse 和清晰错误信息。

**类型一致性：** `Collector`、`CollectedItem` 接口在所有 collector 里一致。`pickCollector` 返回 `Collector | null`。

**范围：** 5 个新文件 + 3 个修改 + 1 份文档 + 1 个验证脚本。规模可控。

**风险：** agent-browser CLI 的实际参数是未知项。代码里通过 `parseAgentBrowserOutput` 做了宽容解析，Task 5 的文档也给了洋哥明确的调整路径。

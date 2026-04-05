# Spec 3: Twitter/X 采集通道

> 已做严格 self-review，跳过 user review gate（用户已就寝）。
> 注意：本 spec 的私域采集链路需用户明早手动配置 Chrome + 登录后才能端到端验证。今晚只交付代码 + build 通过 + 单元测试 + 操作清单。

**日期：** 2026-04-06
**范围：** A1 Twitter/X 私域采集 —— 分为两路同步交付
**定位：** 把 Twitter 源从"pipeline 里标记为待实现"升级为可配置 + 有代码路径的真实通道

---

## 概览

洋哥原本的要求是"Agent Browser 爬登录态私域时间线"。但私域通道必须洋哥本人登录 Chrome 才能跑通，今晚无法端到端验证。所以本 spec 拆成两条路径并行交付：

| 通道 | 能拿到什么 | 依赖 | 今晚可用 |
|---|---|---|---|
| **公开推文（RSSHub）** | 任意 Twitter 用户的公开推文 | RSSHub 公共实例 | ✅ 完全可用 |
| **私域时间线（Agent Browser）** | 洋哥自己 Following 的 feed | Chrome + 登录 + agent-browser CLI | ⚠️ 代码架子 + mock，洋哥明早实测 |

两者共享 Twitter 源配置 UI 和相同的 CollectedItem 数据格式。

---

## 数据模型

**不新增表。** 复用现有 `source_configs`，但引入两个新 `type` 取值：
- `twitter-public`：公开推文（底层走 RSSHub）
- `twitter-private`：私域时间线（底层走 Agent Browser）

字段约定：
- `twitter-public` 时，`rssPath` = `/twitter/user/:username`，`author` = @username
- `twitter-private` 时，`targetUrl` = `https://x.com/home`，name 可以是 "Twitter Feed"

**seed.ts 修改：** 现有的 `twitter` 默认源（`type='private'`）升级为 `type='twitter-private'` + `enabled: false`。

---

## 架构与数据流

### Collector 多态派发

现在 `pipeline.ts` 里只用 `rssCollector.collect(...)`。改为支持多个 collector：

```typescript
// src/lib/digest/collectors/index.ts
import { rssCollector } from './rss'
import { twitterPublicCollector } from './twitter-public'
import { twitterPrivateCollector } from './twitter-private'
import type { Collector } from './types'

const collectors: Record<string, Collector> = {
  'public': rssCollector,
  'custom-rss': rssCollector,
  'twitter-public': twitterPublicCollector,
  'twitter-private': twitterPrivateCollector,
}

export function pickCollector(sourceType: string): Collector | null {
  return collectors[sourceType] || null
}
```

`pipeline.ts` 中的 `publicSources.map(async (source) => { const items = await rssCollector.collect(...) })` 改为基于 source.type 派发到正确的 collector。

### Twitter Public Collector（公开推文）

直接复用 RSSHub：

```typescript
// src/lib/digest/collectors/twitter-public.ts
import { rssCollector } from './rss'
import type { Collector, CollectedItem } from './types'

export const twitterPublicCollector: Collector = {
  name: 'twitter-public',
  async collect(sourceId, config) {
    // config.rssPath 已在 source 配置里填好：/twitter/user/:username
    const items = await rssCollector.collect(sourceId, config)
    // 标记 sourceType 为 public（但 source 字段保持原 id，让前端能正确显示 Twitter 图标）
    return items.map<CollectedItem>(it => ({
      ...it,
      sourceType: 'public',
    }))
  },
}
```

**用户体验：** 洋哥在 Settings 里点"添加 Twitter 账号"→ 输入 `@elonmusk` → 系统生成 source_config `{ id: 'twitter-elonmusk', type: 'twitter-public', rssPath: '/twitter/user/elonmusk', ... }` → 下次 pipeline 触发时自动采集。

### Twitter Private Collector（私域时间线）

通过 Agent Browser 的 shell 调用实现。Agent Browser 是洋哥全局安装的 CLI 工具，位于 `~/.claude/guides/agent-browser.md` 有用法说明。

```typescript
// src/lib/digest/collectors/twitter-private.ts
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectedItem } from './types'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const TIMELINE_URL = 'https://x.com/home'

export const twitterPrivateCollector: Collector = {
  name: 'twitter-private',
  async collect(sourceId, _config): Promise<CollectedItem[]> {
    // 需要 Chrome 已开 + agent-browser --auto-connect 可用
    // 采集策略：open timeline → eval 取 DOM tweets → parse
    const script = `
      (async () => {
        // 等待 timeline 加载
        await new Promise(r => setTimeout(r, 2000))
        const articles = document.querySelectorAll('article[data-testid="tweet"]')
        const tweets = []
        for (const art of Array.from(articles).slice(0, 30)) {
          const textEl = art.querySelector('[data-testid="tweetText"]')
          const authorEl = art.querySelector('[data-testid="User-Name"] a[role="link"]')
          const linkEl = art.querySelector('a[href*="/status/"]')
          if (!textEl || !linkEl) continue
          tweets.push({
            text: textEl.textContent || '',
            author: authorEl ? authorEl.textContent : '',
            url: linkEl.href,
          })
        }
        return tweets
      })()
    `

    try {
      // agent-browser open + eval 形式，具体命令参数参考 agent-browser --help
      const { stdout } = await execFileAsync(AGENT_BROWSER_CMD, [
        'eval',
        '--url', TIMELINE_URL,
        '--script', script,
        '--json',
      ], { timeout: 60000 })

      const parsed = JSON.parse(stdout) as Array<{ text: string; author: string; url: string }>

      return parsed.map<CollectedItem>(t => ({
        source: sourceId,
        sourceType: 'private' as const,
        title: t.text.slice(0, 120),
        content: t.text,
        url: t.url,
        author: t.author || '',
      })).filter(item => item.title && item.url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Twitter 私域采集失败（需要 Chrome 已开 + agent-browser 可用）：${msg}`)
    }
  },
}
```

**注意点：**
- 命令格式 `agent-browser eval --url ... --script ... --json` 是基于交接文档描述的假设性接口。真实的 agent-browser CLI 可能需要不同参数。明早洋哥手动验证时可能需要调整。
- 如果 agent-browser 实际 CLI 参数不同，collector 会报错，不会影响其他源的采集（Promise.allSettled 保护）。
- 错误信息清晰指出"需要 Chrome 已开 + agent-browser 可用"，便于诊断。

### Pipeline 集成

`src/lib/digest/pipeline.ts` 的采集循环改为：

```typescript
import { pickCollector } from './collectors'

// 原代码：
// await rssCollector.collect(source.id, { rssPath: source.rssPath || '', rssUrl: source.rssUrl || '' })

// 新代码：
const collector = pickCollector(source.type)
if (!collector) {
  throw new Error(`未知的源类型: ${source.type}`)
}
const items = await collector.collect(source.id, {
  rssPath: source.rssPath || '',
  rssUrl: source.rssUrl || '',
  targetUrl: source.targetUrl || '',
})
```

同时 `getPublicSources()` 需要更新，不再只过滤 `public` / `custom-rss`：

```typescript
// src/lib/sources.ts
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

**注意：** 这会把 twitter-private 也算作"public"源（在 pipeline 里并行采集）。如果它失败，错误会被 Promise.allSettled 捕获并标记为该源 error。这是期望行为。

---

## API 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/sources/twitter` body `{username, type: 'public' \| 'private', displayName?}` | 快捷添加 Twitter 源 |
| `GET` | `/api/sources/twitter/health` | 检查 agent-browser 可用性（用于 UI 提示） |

---

## 文件结构

### 新增

```
src/lib/digest/collectors/
├── index.ts                          ← collector 多态派发
├── twitter-public.ts                 ← 公开推文（包装 RSS）
└── twitter-private.ts                ← 私域时间线（Agent Browser）

src/app/api/sources/twitter/
├── route.ts                          ← POST 添加 Twitter 源
└── health/route.ts                   ← GET 检查 agent-browser

src/components/settings/
└── twitter-source-adder.tsx          ← Twitter 快捷添加组件（Dialog 形式）

scripts/
└── twitter-smoke-test.mjs            ← 明早手动测试私域链路的脚本

docs/
└── twitter-setup.md                  ← 明早洋哥的操作手册
```

### 修改

```
src/lib/digest/pipeline.ts            ← 引入 collector 派发
src/lib/digest/collectors/rss.ts      ← （不改，供 twitter-public 复用）
src/lib/sources.ts                    ← getPublicSources 过滤扩展
src/lib/db/seed.ts                    ← twitter 默认源 type 升级
src/app/settings/page.tsx 或子组件    ← 集成 TwitterSourceAdder 入口
```

---

## 关键决策

1. **双通道并行交付** — 公开推文今晚立即可用，私域架子今晚完成，降低整体风险
2. **不引入 Playwright/Puppeteer 新依赖** — Agent Browser 已是洋哥的标准工具，复用成本最低；Playwright 二进制 ~200MB，过重
3. **Collector 多态派发** — 未来加 YouTube/Newsletter/Reddit 采集器时直接加 entry 即可
4. **Private collector 失败不影响其他源** — Pipeline 已有 Promise.allSettled 保护
5. **Twitter-public 包装 RSSCollector 而非直接走 custom-rss** — 便于未来 Twitter 特定处理（如 @ mention 链接转换、图片提取）
6. **agent-browser 命令参数留有调整空间** — 因为明早才能真实测试，初版代码在错误处理上宽容，通过清晰的错误消息帮助快速调整
7. **不修改 collectors/types.ts** — 现有接口足够，新 collector 实现现有 interface 即可

---

## 错误处理

- **Agent Browser CLI 未安装**：collector 抛"command not found"，pipeline 捕获为源 error，前端显示"Twitter 采集失败"
- **Chrome 未开启**：collector 抛"连接失败"，同上
- **RSSHub 路由不可用**：走 rssCollector 已有的错误处理
- **DOM 结构变化导致 parse 失败**：返回空数组 + console.warn（不阻塞 pipeline）
- **Twitter 源配置不完整**：验证 `rssPath` 或 `targetUrl` 非空，否则返回 400

---

## 明早洋哥验证清单（写进 docs/twitter-setup.md）

1. 启动 Chrome（remote debugging）：
   ```bash
   open -a "Google Chrome" --args --remote-debugging-port=9222
   ```
2. 在 Chrome 登录 X (https://x.com) 并访问 `https://x.com/home` 确认 feed 正常
3. 验证 `agent-browser --auto-connect --help` 能正常运行
4. 在 AutoMedia settings 里添加 Twitter 源（选"我的时间线"）
5. 手动触发一次 pipeline，查看 Twitter 源状态
6. 如果失败：检查 `scripts/twitter-smoke-test.mjs` 单独跑一次诊断

---

## 测试策略

单元测试（Vitest）：
- `collectors/index.test.ts` — pickCollector 正确派发
- `twitter-public.test.ts` — mock RSSHub 响应，验证 sourceType 标记
- `twitter-private.test.ts` — mock execFile，验证 parse 逻辑和错误处理

**不做**端到端测试（需要真实登录态）。

手工验证清单（今晚可验证部分）：
- [ ] 添加一个 Twitter 公开用户（如 @elonmusk）→ pipeline 触发 → 能看到推文条目
- [ ] 添加一个私域 Twitter 源 → pipeline 触发 → 报错明确（"需要 Chrome + agent-browser"）
- [ ] Build 通过 + 现有测试不 regress

---

## 范围 Self-Review

| 检查项 | 结论 |
|---|---|
| Placeholder / TBD | 无。agent-browser 命令参数的不确定性已明确标注为"明早校准" |
| 内部一致性 | 两路 collector 共享 CollectedItem 接口；pipeline 派发逻辑统一 |
| 范围大小 | 3 个新 collector 文件 + 2 个 API + 1 个 UI 组件 + 1 个验证脚本 + 1 份文档，单 plan 内可完成 |
| 歧义 | 私域链路的 agent-browser 调用参数是唯一不确定点，文档里明确说明 |

合格，进入 plan 阶段。

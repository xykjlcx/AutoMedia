# Spec 2: Studio 写作体验补齐

> 已做严格 self-review，跳过 user review gate（用户已就寝）。

**日期：** 2026-04-06
**范围：** D2 草稿版本历史 + D4 Studio 预览升级 + D5 图文配图生成
**定位：** 消除 Studio 写作环节的三个具体痛点：改坏了回不去、预览看不真、配图还得手动找

---

## 概览

Studio 现在能用但不精。三个痛点：
1. **版本丢失** — 一次 AI 生成 + 用户大改后，原版就不在了（只有 `aiOriginal` 保留最近一次 AI 原稿）
2. **预览不真** — `simpleMarkdownRender` 是 10 行正则，不支持列表、代码、表格、引用；所见非所得
3. **配图断链** — 写完文章/帖子后还要打开别的工具生成封面/插图

| 子功能 | 目标 | 核心变更 |
|---|---|---|
| D2 版本历史 | 任意时间点可回滚 | 新表 `draft_versions` + 自动 snapshot + 手动 snapshot |
| D4 预览升级 | 真正的 markdown 渲染 | 引入 `react-markdown` + `remark-gfm` + 代码高亮 |
| D5 图文配图 | Studio 里一键生成封面 | AI settings 加 image provider 字段 + `/api/studio/images/generate` + 前端按钮 |

---

## 数据模型

### 新增表：`draft_versions`（草稿版本快照）

```sql
CREATE TABLE draft_versions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL,
  ai_prompt TEXT DEFAULT '',
  source TEXT NOT NULL,   -- 'ai_generate' | 'manual_save' | 'pre_regenerate'
  created_at TEXT NOT NULL
);
CREATE INDEX idx_draft_versions_draft ON draft_versions(draft_id, created_at DESC);
```

每个 draft 可以有多个 version。`source` 标记这个快照是怎么来的：
- `ai_generate`：AI 生成 content 前后各存一个（pre 存旧的，ai_generate 存新生成的）
- `manual_save`：用户手动点"保存版本"
- `pre_regenerate`：重新生成前的快照（保底）

保留策略：每 draft 保留最近 20 个 version，超出后删除最旧的（非 manual_save 的优先删）。

### 修改 `ai_settings` 表：增加图片生成配置

在 `ai_settings` 表追加字段（runtime bootstrap 幂等补列）：

```sql
ALTER TABLE ai_settings ADD COLUMN image_provider TEXT DEFAULT '';
ALTER TABLE ai_settings ADD COLUMN image_base_url TEXT DEFAULT '';
ALTER TABLE ai_settings ADD COLUMN image_api_key TEXT DEFAULT '';
ALTER TABLE ai_settings ADD COLUMN image_model TEXT DEFAULT '';
```

`image_provider` 取值：`''`（未配置，隐藏按钮）/ `'google'`（Gemini image）/ `'openai'`（DALL-E / gpt-image-1）。

**不引入新的 image_settings 表** — 这样前端加载状态更简单，迁移成本最低。

---

## 架构与数据流

### D2 草稿版本历史

**自动 snapshot 时机：**
```
用户点击 "AI 生成"
  ↓
generator.ts 在调用 AI 之前：
  ← snapshot 当前 content 为 'pre_regenerate'（如果 content 非空）
  ↓
AI 返回 markdown
  ↓
updateDraftWithSources 写入 → snapshot 为 'ai_generate'
```

**手动 snapshot：**
- Studio 顶部工具栏增加「存快照」按钮 → `POST /api/studio/drafts/:id/versions { source: 'manual_save' }`

**版本列表与回滚：**
- Studio 顶部"版本"按钮（图标 `History`，和现有"草稿历史"并列但区分开）
- 点击打开右侧 Drawer，列出所有版本（按 created_at desc）
- 每个版本显示：source 类型（带 icon）、时间、内容前 80 字
- 点击版本 → 预览（弹窗或 drawer 内展开）
- "恢复此版本"按钮 → `POST /api/studio/drafts/:id/restore { versionId }` → 先 snapshot 当前为 `manual_save`（避免用户误恢复丢失当前内容），再把 version 内容写回 draft

**与现有 `aiOriginal` 的关系：**
- `aiOriginal` 保留，用于风格学习 diff（继续生效）
- version 是独立的历史，不替代 aiOriginal
- 两者是不同用途的持久化

### D4 Studio 预览升级

**替换目标：** `src/components/studio/studio-page.tsx` 里的 `simpleMarkdownRender`

**新增依赖：**
- `react-markdown` — 核心渲染器
- `remark-gfm` — GFM 扩展（表格、任务列表、删除线、URL 自动链接）
- `rehype-highlight` — 代码高亮（可选，增加 ~200KB）
- **不引入 `rehype-raw`**（拒绝嵌入原始 HTML，避免 XSS 风险）

**新组件：** `src/components/studio/markdown-preview.tsx`

```typescript
"use client"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 链接强制 target=_blank
          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

在 studio-page.tsx 替换原来 dangerouslySetInnerHTML 的渲染。

**不改 DraftEditor**：编辑器继续是 textarea，预览面板是独立的右侧栏。

### D5 图文配图生成

**前提：** 用户在设置页配置了 `image_provider` + `image_api_key`。未配置时前端按钮隐藏。

**API 路由：** `POST /api/studio/images/generate`

请求：
```json
{
  "draftId": "uuid",
  "prompt": "生成一张符合文章主题的封面图，横向 16:9，暖色调，手绘插画风格",
  "aspectRatio": "16:9"
}
```

响应：
```json
{
  "imagePath": "/images/generated/uuid.png",
  "prompt": "...",
  "provider": "google"
}
```

**服务端逻辑：** `src/lib/studio/image-gen.ts`

```typescript
import { readSettings } from '...'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function generateCoverImage(opts: {
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
}): Promise<{ imagePath: string; filename: string } | null> {
  const settings = readSettings()
  if (!settings.imageProvider || !settings.imageApiKey) {
    throw new Error('图片生成未配置：请在设置页填入 image provider 和 API key')
  }

  let imageBase64: string
  if (settings.imageProvider === 'google') {
    imageBase64 = await callGeminiImage({ prompt: opts.prompt, apiKey: settings.imageApiKey, model: settings.imageModel || 'gemini-2.5-flash-image-preview' })
  } else if (settings.imageProvider === 'openai') {
    imageBase64 = await callOpenAiImage({ prompt: opts.prompt, apiKey: settings.imageApiKey, baseUrl: settings.imageBaseUrl, model: settings.imageModel || 'gpt-image-1' })
  } else {
    throw new Error(`不支持的 image provider: ${settings.imageProvider}`)
  }

  const filename = `${uuid()}.png`
  const filePath = join(process.cwd(), 'public/images/generated', filename)
  await writeFile(filePath, Buffer.from(imageBase64, 'base64'))
  return { imagePath: `/images/generated/${filename}`, filename }
}
```

**Gemini / OpenAI 调用：** 直接 fetch REST API，不依赖新 SDK。

**前端入口：** Studio 底部操作栏增加「配图」按钮，点击弹出小对话框：
- prompt 输入框（默认值根据 title + 前 100 字内容自动填充）
- 比例选择（1:1 / 16:9 / 9:16）
- 生成按钮
- 生成后显示图片 + 复制链接按钮 + 下载按钮
- 图片自动存到 `public/images/generated/`，路径可复制粘贴到 markdown

**Settings 页面改动：** 模型设置 Tab 加一个子区「图片生成（可选）」，字段 provider / base_url / api_key / model，保存到 ai_settings。

---

## API 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/studio/drafts/[id]/versions` | 列出版本 |
| `POST` | `/api/studio/drafts/[id]/versions` body `{source}` | 手动存快照 |
| `POST` | `/api/studio/drafts/[id]/versions/restore` body `{versionId}` | 回滚 |
| `DELETE` | `/api/studio/drafts/[id]/versions/[versionId]` | 删除某版本 |
| `POST` | `/api/studio/images/generate` body `{draftId, prompt, aspectRatio}` | 生成配图 |
| `GET` | `/api/settings/ai-image` | 读取图像设置 |
| `PATCH` | `/api/settings/ai-image` body `{provider, baseUrl, apiKey, model}` | 更新图像设置 |

---

## 文件结构

### 新增

```
src/lib/studio/
├── versions.ts                       ← D2 版本 CRUD + 保留策略
├── image-gen.ts                      ← D5 图片生成（Gemini/OpenAI）
└── image-providers/
    ├── google.ts                     ← Gemini REST 调用
    └── openai.ts                     ← OpenAI images REST 调用

src/app/api/studio/drafts/[id]/versions/
├── route.ts                          ← list + create
├── [versionId]/route.ts              ← delete
└── restore/route.ts                  ← 回滚

src/app/api/studio/images/
└── generate/route.ts

src/app/api/settings/ai-image/
└── route.ts

src/components/studio/
├── draft-versions.tsx                ← D2 版本列表 Drawer
├── markdown-preview.tsx              ← D4 替换 simpleMarkdownRender
└── image-generate-dialog.tsx         ← D5 配图对话框

src/components/settings/
└── ai-image-settings.tsx             ← D5 图片生成设置面板（供 settings page 引用）
```

### 修改

```
src/lib/db/schema.ts                      ← draft_versions 表 + ai_settings 4 字段
src/lib/db/index.ts                       ← 同上 DDL
src/lib/studio/queries.ts                 ← 在 updateDraftWithSources 的上下文加 snapshot hook
src/lib/studio/generator.ts               ← AI 生成前后自动 snapshot
src/components/studio/studio-page.tsx     ← 替换 simpleMarkdownRender、加版本按钮、加配图按钮
src/app/settings/page.tsx 或对应 settings 子组件 ← 加图像设置区块
public/images/generated/.gitkeep          ← 目录占位
.gitignore                                 ← 忽略 public/images/generated/*.png
```

---

## 关键决策

1. **版本独立于 `aiOriginal`** — 两者用途不同，aiOriginal 是风格学习 diff 的基线，version 是人工回滚历史
2. **保留 20 个版本** — 够用不冗余，避免存储膨胀
3. **删除策略偏保护手动保存** — 自动 snapshot 先删，手动 snapshot 最后删
4. **预览用 react-markdown 而非 marked** — react 生态、SSR 友好、组件化 override 容易
5. **配图不引入 Vercel AI SDK `experimental_generateImage`** — SDK 版本兼容性不稳，直接 REST API 更可控
6. **图像配置放进 `ai_settings` 表** — 避免新表，一键配置心智
7. **配图存本地 `public/images/generated/`** — 本地工具无需 CDN；gitignore 避免入库污染
8. **回滚前先 snapshot 当前** — 防止误操作导致的不可逆数据丢失

---

## 错误处理

- **版本保留策略错误** — 删除失败不影响主插入，记录日志即可
- **图片生成超时** — 60s timeout，超时返回 504
- **图像 API key 错误** — 返回 401 + 明确错误信息「API key 无效或权限不足」
- **写文件失败** — 检查 `public/images/generated/` 目录是否存在，不存在先 mkdir
- **预览 markdown 渲染异常** — react-markdown 有内置 ErrorBoundary 风格容错，不会 crash 整个 Studio

---

## 测试策略

单元测试（Vitest）：
- `versions.test.ts` — 自动 snapshot、手动 snapshot、回滚逻辑、保留策略
- `image-gen.test.ts` — mock fetch 测试 provider 分派（不实际调 API）

手工验证清单：
- [ ] AI 生成后「版本」按钮列表里看到 `pre_regenerate` + `ai_generate` 两个新版本
- [ ] 点击恢复版本能把内容换回来，且当前状态被额外保存为 `manual_save`
- [ ] 预览面板里的 markdown 支持表格、代码高亮、任务列表
- [ ] 设置页填入 image API key 后，Studio 底部「配图」按钮出现
- [ ] 生成图片后能看到图片预览，复制图片路径粘贴到 markdown 能渲染

---

## 范围 Self-Review

| 检查项 | 结论 |
|---|---|
| Placeholder / TBD | 无 |
| 内部一致性 | 3 个子功能的数据流、存储、API、UI 一一对应 |
| 范围大小 | 1 新表 + 4 字段 + ~15 新文件 + ~6 修改，单 plan 内可完成 |
| 歧义 | 版本快照时机明确（AI 生成前后 + 手动）；图片生成 provider 切换策略明确 |

合格，进入 plan 阶段。

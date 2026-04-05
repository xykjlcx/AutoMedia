# Spec 2 实施计划：Studio 写作体验补齐

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 交付 D2 草稿版本历史 + D4 预览升级 + D5 配图生成。

**Architecture:** 1 新表 + ai_settings 追加 4 字段 + 引入 react-markdown + 调用 Gemini/OpenAI image REST API。

**Tech Stack:** Drizzle + better-sqlite3 / react-markdown / remark-gfm / rehype-highlight / fetch REST。

---

## 文件结构

新增：
```
src/lib/studio/versions.ts
src/lib/studio/image-gen.ts
src/lib/studio/image-providers/google.ts
src/lib/studio/image-providers/openai.ts
src/app/api/studio/drafts/[id]/versions/route.ts
src/app/api/studio/drafts/[id]/versions/[versionId]/route.ts
src/app/api/studio/drafts/[id]/versions/restore/route.ts
src/app/api/studio/images/generate/route.ts
src/app/api/settings/ai-image/route.ts
src/components/studio/draft-versions.tsx
src/components/studio/markdown-preview.tsx
src/components/studio/image-generate-dialog.tsx
public/images/generated/.gitkeep
```

修改：
```
src/lib/db/schema.ts
src/lib/db/index.ts
src/lib/studio/generator.ts
src/components/studio/studio-page.tsx
src/app/settings/page.tsx
.gitignore
package.json（新增 3 个依赖）
```

---

## Task 1: 数据库 Schema + DDL

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 在 `src/lib/db/schema.ts` 末尾追加 draft_versions 表**

```typescript
// 草稿版本快照
export const draftVersions = sqliteTable('draft_versions', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  platform: text('platform').notNull(),
  aiPrompt: text('ai_prompt').default(''),
  source: text('source').notNull(), // 'ai_generate' | 'manual_save' | 'pre_regenerate'
  createdAt: text('created_at').notNull(),
})
```

同时在 `aiSettings` 表定义中追加 4 个字段（如 schema.ts 里已有 aiSettings 定义，直接追加列）：

```typescript
// 在现有 aiSettings 定义里加入：
imageProvider: text('image_provider').default(''),
imageBaseUrl: text('image_base_url').default(''),
imageApiKey: text('image_api_key').default(''),
imageModel: text('image_model').default(''),
```

- [ ] **Step 2: 在 `src/lib/db/index.ts` 的 runtime bootstrap 区追加**

```typescript
// Spec 2: Studio 版本历史
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS draft_versions (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL,
    ai_prompt TEXT DEFAULT '',
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_draft_versions_draft ON draft_versions(draft_id, created_at DESC)`)

// ai_settings 追加图像生成相关字段（幂等 try/catch）
for (const col of ['image_provider', 'image_base_url', 'image_api_key', 'image_model']) {
  try {
    sqlite.exec(`ALTER TABLE ai_settings ADD COLUMN ${col} TEXT DEFAULT ''`)
  } catch {
    // 已存在，忽略
  }
}
```

- [ ] **Step 3: 生成并修正 migration（可选）**

```bash
pnpm db:generate
```
如果生成了新 migration 文件，打开手动加 `IF NOT EXISTS`。

- [ ] **Step 4: Build 验证**

```bash
pnpm build
```

---

## Task 2: 安装前端依赖

- [ ] **Step 1: 安装 react-markdown 和扩展**

```bash
cd /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia && pnpm add react-markdown remark-gfm rehype-highlight highlight.js
```

- [ ] **Step 2: 构建验证（只是安装，build 应该依然通过）**

```bash
pnpm build
```

---

## Task 3: 版本管理 lib + API

**Files:**
- Create: `src/lib/studio/versions.ts`
- Create: `src/app/api/studio/drafts/[id]/versions/route.ts`
- Create: `src/app/api/studio/drafts/[id]/versions/[versionId]/route.ts`
- Create: `src/app/api/studio/drafts/[id]/versions/restore/route.ts`

- [ ] **Step 1: 创建 `src/lib/studio/versions.ts`**

```typescript
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'

const MAX_VERSIONS_PER_DRAFT = 20

export type VersionSource = 'ai_generate' | 'manual_save' | 'pre_regenerate'

export interface DraftVersion {
  id: string
  draftId: string
  title: string
  content: string
  platform: string
  aiPrompt: string
  source: VersionSource
  createdAt: string
}

export function snapshotDraft(draftId: string, source: VersionSource): string | null {
  // 读当前 draft
  const draft = db.$client.prepare(`
    SELECT id, title, content, platform, ai_prompt as aiPrompt
    FROM drafts WHERE id = ?
  `).get(draftId) as { id: string; title: string; content: string; platform: string; aiPrompt: string } | undefined

  if (!draft) return null
  // 空内容不存快照（没意义）
  if (!draft.content || draft.content.trim().length === 0) return null

  const id = uuid()
  db.$client.prepare(`
    INSERT INTO draft_versions (id, draft_id, title, content, platform, ai_prompt, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    draftId,
    draft.title || '',
    draft.content,
    draft.platform,
    draft.aiPrompt || '',
    source,
    new Date().toISOString()
  )

  // 保留策略：每个 draft 最多 20 个 version，超出删最旧的非 manual_save
  enforceRetention(draftId)
  return id
}

function enforceRetention(draftId: string) {
  const all = db.$client.prepare(`
    SELECT id, source, created_at FROM draft_versions
    WHERE draft_id = ? ORDER BY created_at DESC
  `).all(draftId) as Array<{ id: string; source: string; created_at: string }>

  if (all.length <= MAX_VERSIONS_PER_DRAFT) return

  const excess = all.length - MAX_VERSIONS_PER_DRAFT
  // 优先删最旧的非 manual_save
  const deletable = all
    .filter(v => v.source !== 'manual_save')
    .slice(-excess)

  const stmt = db.$client.prepare(`DELETE FROM draft_versions WHERE id = ?`)
  for (const v of deletable) stmt.run(v.id)
}

export function listVersions(draftId: string): DraftVersion[] {
  return db.$client.prepare(`
    SELECT id, draft_id as draftId, title, content, platform, ai_prompt as aiPrompt, source, created_at as createdAt
    FROM draft_versions
    WHERE draft_id = ?
    ORDER BY created_at DESC
  `).all(draftId) as DraftVersion[]
}

export function getVersion(versionId: string): DraftVersion | null {
  const row = db.$client.prepare(`
    SELECT id, draft_id as draftId, title, content, platform, ai_prompt as aiPrompt, source, created_at as createdAt
    FROM draft_versions WHERE id = ?
  `).get(versionId) as DraftVersion | undefined
  return row || null
}

export function deleteVersion(versionId: string): void {
  db.$client.prepare(`DELETE FROM draft_versions WHERE id = ?`).run(versionId)
}

export function restoreVersion(draftId: string, versionId: string): boolean {
  const version = getVersion(versionId)
  if (!version || version.draftId !== draftId) return false

  // 回滚前先 snapshot 当前内容为 manual_save（防止误操作）
  snapshotDraft(draftId, 'manual_save')

  // 应用 version 内容到当前 draft
  db.$client.prepare(`
    UPDATE drafts SET title = ?, content = ?, platform = ?, ai_prompt = ?, updated_at = ?
    WHERE id = ?
  `).run(
    version.title,
    version.content,
    version.platform,
    version.aiPrompt,
    new Date().toISOString(),
    draftId
  )
  return true
}
```

- [ ] **Step 2: 创建 `src/app/api/studio/drafts/[id]/versions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { listVersions, snapshotDraft, type VersionSource } from '@/lib/studio/versions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const versions = listVersions(id)
  return NextResponse.json({ versions })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const source: VersionSource = body?.source === 'manual_save' ? 'manual_save' : 'manual_save'
  const versionId = snapshotDraft(id, source)
  if (!versionId) {
    return NextResponse.json({ error: '草稿内容为空，无法保存版本' }, { status: 400 })
  }
  return NextResponse.json({ id: versionId })
}
```

- [ ] **Step 3: 创建 `src/app/api/studio/drafts/[id]/versions/[versionId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { deleteVersion } from '@/lib/studio/versions'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { versionId } = await params
  deleteVersion(versionId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: 创建 `src/app/api/studio/drafts/[id]/versions/restore/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { restoreVersion } from '@/lib/studio/versions'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const versionId = body?.versionId
  if (!versionId) {
    return NextResponse.json({ error: '缺少 versionId' }, { status: 400 })
  }
  const ok = restoreVersion(id, versionId)
  if (!ok) {
    return NextResponse.json({ error: '版本不存在或不属于该草稿' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Build 验证**

```bash
pnpm build
```

---

## Task 4: Generator 集成自动 Snapshot

**Files:**
- Modify: `src/lib/studio/generator.ts`

- [ ] **Step 1: 在 generator.ts 顶部 import**

```typescript
import { snapshotDraft } from './versions'
```

- [ ] **Step 2: 在 `generateContent` 函数里的 "调用 AI" 之前和 "更新草稿" 之后各加一次 snapshot**

参考以下位置插入（generator.ts 里 `getStyleProfile(platform)` 这行之后、`generateObject` 之前）：

```typescript
  // 调用 AI 之前 snapshot 当前内容（若非空），作为"重新生成前的版本"
  snapshotDraft(draftId, 'pre_regenerate')
```

在 `updateDraft(draftId, { ... })` 之后加：

```typescript
  // AI 生成完成后 snapshot 新内容
  snapshotDraft(draftId, 'ai_generate')
```

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

---

## Task 5: 前端 Draft Versions Drawer

**Files:**
- Create: `src/components/studio/draft-versions.tsx`
- Modify: `src/components/studio/studio-page.tsx`

- [ ] **Step 1: 创建 `src/components/studio/draft-versions.tsx`**

```typescript
"use client"

import { useEffect, useState } from 'react'
import { X, RotateCcw, Sparkles, Save, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Version {
  id: string
  draftId: string
  title: string
  content: string
  platform: string
  aiPrompt: string
  source: 'ai_generate' | 'manual_save' | 'pre_regenerate'
  createdAt: string
}

interface DraftVersionsProps {
  draftId: string
  onClose: () => void
  onRestored: () => void
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Sparkles }> = {
  ai_generate: { label: 'AI 生成', icon: Sparkles },
  manual_save: { label: '手动保存', icon: Save },
  pre_regenerate: { label: '重新生成前', icon: RefreshCcw },
}

export function DraftVersions({ draftId, onClose, onRestored }: DraftVersionsProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Version | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/studio/drafts/${draftId}/versions`)
      const json = await res.json()
      setVersions(json.versions || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [draftId])

  const handleRestore = async (versionId: string) => {
    if (!confirm('恢复此版本？当前内容会被自动备份为手动保存的版本。')) return
    const res = await fetch(`/api/studio/drafts/${draftId}/versions/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId }),
    })
    if (res.ok) {
      onRestored()
      onClose()
    }
  }

  const handleManualSave = async () => {
    const res = await fetch(`/api/studio/drafts/${draftId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual_save' }),
    })
    if (res.ok) load()
  }

  return (
    <div className="w-80 border-r border-border/60 overflow-y-auto shrink-0 bg-card flex flex-col">
      <div className="px-3 py-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-sm font-medium">版本历史</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleManualSave}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="保存当前为快照"
          >
            <Save className="size-3.5" />
          </button>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-6">加载中...</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">还没有版本</p>
        ) : (
          versions.map(v => {
            const cfg = SOURCE_LABELS[v.source] || { label: v.source, icon: Save }
            const Icon = cfg.icon
            const preview = v.content.slice(0, 80).replace(/\n+/g, ' ')
            const time = new Date(v.createdAt).toLocaleString('zh-CN', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })
            return (
              <div
                key={v.id}
                onClick={() => setSelected(v)}
                className={cn(
                  'group relative p-2.5 rounded-lg border cursor-pointer transition-colors',
                  selected?.id === v.id
                    ? 'border-[var(--color-warm-accent)]/40 bg-[var(--color-warm-accent)]/5'
                    : 'border-border/40 hover:border-border'
                )}
              >
                <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                  <Icon className="size-3" />
                  <span>{cfg.label}</span>
                  <span className="ml-auto">{time}</span>
                </div>
                <p className="text-xs text-foreground line-clamp-2 leading-snug">{preview}</p>
                {selected?.id === v.id && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore(v.id) }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[var(--color-warm-accent)] text-white hover:opacity-90"
                    >
                      <RotateCcw className="size-3" />
                      恢复此版本
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/components/studio/studio-page.tsx` 集成**

在 import 区加入：
```typescript
import { DraftVersions } from './draft-versions'
import { History as HistoryIcon } from 'lucide-react'  // 或复用已有 History
```
（注意不要和现有 `History` 的 import 冲突，名称留意）

在 state 里加：
```typescript
const [versionsOpen, setVersionsOpen] = useState(false)
```

在编辑器头部的按钮组（History 按钮旁边）加一个「版本」按钮：
```tsx
{draft.id && (
  <button
    onClick={() => setVersionsOpen(!versionsOpen)}
    className={cn(
      'p-1.5 rounded-md transition-colors',
      versionsOpen ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'hover:bg-muted text-muted-foreground'
    )}
    title="版本历史"
  >
    <RotateCcw className="size-4" />
  </button>
)}
```
注意需要从 lucide-react 导入 `RotateCcw`。

在主体三栏 `<div className="flex-1 flex overflow-hidden">` 里，在 DraftHistory 抽屉之后、左侧素材面板之前插入：
```tsx
{versionsOpen && draft.id && (
  <DraftVersions
    draftId={draft.id}
    onClose={() => setVersionsOpen(false)}
    onRestored={async () => {
      if (draft.id) {
        await loadDraft(draft.id)
      }
    }}
  />
)}
```

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit D2**

```bash
git add -A && git commit -m "功能：D2 草稿版本历史（自动 snapshot + 手动保存 + 回滚 + 20 版本保留）"
```

---

## Task 6: Markdown 预览升级

**Files:**
- Create: `src/components/studio/markdown-preview.tsx`
- Modify: `src/components/studio/studio-page.tsx`

- [ ] **Step 1: 创建 `src/components/studio/markdown-preview.tsx`**

```typescript
"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

export function MarkdownPreview({ content, title }: { content: string; title?: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-serif-display prose-a:text-[var(--color-warm-accent)] prose-code:text-[var(--color-warm-accent)]">
      {title && <h1 className="text-xl font-bold font-serif-display mb-4">{title}</h1>}
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground/50 italic">暂无内容</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/components/studio/studio-page.tsx` 替换预览**

在 import 区加入：
```typescript
import { MarkdownPreview } from './markdown-preview'
```

在右侧预览面板里，把原来：
```tsx
<div className="prose prose-sm dark:prose-invert max-w-none">
  {draft.title && <h1 className="text-xl font-bold font-serif-display mb-4">{draft.title}</h1>}
  {draft.content ? (
    <div dangerouslySetInnerHTML={{ __html: simpleMarkdownRender(draft.content) }} />
  ) : (
    <p className="text-muted-foreground/50 italic">暂无内容</p>
  )}
</div>
```

替换为：
```tsx
<MarkdownPreview content={draft.content} title={draft.title} />
```

**同时删除文件底部的 `simpleMarkdownRender` 函数。**

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit D4**

```bash
git add -A && git commit -m "功能：D4 Studio 预览升级（react-markdown + GFM + 代码高亮，替换正则渲染）"
```

---

## Task 7: 图片生成 Provider 抽象

**Files:**
- Create: `src/lib/studio/image-providers/google.ts`
- Create: `src/lib/studio/image-providers/openai.ts`
- Create: `src/lib/studio/image-gen.ts`

- [ ] **Step 1: 创建 `src/lib/studio/image-providers/google.ts`**

```typescript
// Gemini 图片生成 REST API 调用
// 参考：https://ai.google.dev/gemini-api/docs/image-generation

export async function generateWithGemini(opts: {
  prompt: string
  apiKey: string
  model?: string
}): Promise<string> {
  const model = opts.model || 'gemini-2.5-flash-image-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini image API 失败 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }>
  }

  const parts = data.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data // base64
    }
  }
  throw new Error('Gemini 响应中未找到图片数据')
}
```

- [ ] **Step 2: 创建 `src/lib/studio/image-providers/openai.ts`**

```typescript
// OpenAI 图片生成 REST API 调用
// 参考：https://platform.openai.com/docs/api-reference/images/create

export async function generateWithOpenAI(opts: {
  prompt: string
  apiKey: string
  baseUrl?: string
  model?: string
  size?: string
}): Promise<string> {
  const model = opts.model || 'gpt-image-1'
  const size = opts.size || '1024x1024'
  const base = opts.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com'
  const url = `${base}/v1/images/generations`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI image API 失败 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as {
    data?: Array<{ b64_json?: string; url?: string }>
  }

  const item = data.data?.[0]
  if (item?.b64_json) return item.b64_json
  if (item?.url) {
    // 有些模型只返回 url，这里下载
    const imgRes = await fetch(item.url)
    const buf = await imgRes.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  }
  throw new Error('OpenAI 响应中未找到图片数据')
}
```

- [ ] **Step 3: 创建 `src/lib/studio/image-gen.ts`**

```typescript
import { v4 as uuid } from 'uuid'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { db } from '@/lib/db/index'
import { aiSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateWithGemini } from './image-providers/google'
import { generateWithOpenAI } from './image-providers/openai'

const OUTPUT_DIR = join(process.cwd(), 'public/images/generated')

export interface GenerateCoverImageInput {
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
}

export interface GenerateCoverImageResult {
  imagePath: string
  filename: string
  provider: string
}

function getImageSettings() {
  const row = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).get()
  if (!row) return null
  return {
    provider: row.imageProvider || '',
    baseUrl: row.imageBaseUrl || '',
    apiKey: row.imageApiKey || '',
    model: row.imageModel || '',
  }
}

function ratioToSize(ratio?: string): string {
  switch (ratio) {
    case '16:9': return '1536x1024'
    case '9:16': return '1024x1536'
    case '4:3': return '1280x960'
    case '3:4': return '960x1280'
    case '1:1':
    default: return '1024x1024'
  }
}

function buildPromptWithRatio(prompt: string, ratio?: string): string {
  const ratioHint = ratio === '16:9' ? '，横向 16:9 比例'
    : ratio === '9:16' ? '，竖向 9:16 比例'
    : ratio === '4:3' ? '，横向 4:3 比例'
    : ratio === '3:4' ? '，竖向 3:4 比例'
    : '，正方形 1:1 比例'
  return `${prompt}${ratioHint}`
}

export async function generateCoverImage(input: GenerateCoverImageInput): Promise<GenerateCoverImageResult> {
  const settings = getImageSettings()
  if (!settings?.provider || !settings.apiKey) {
    throw new Error('图片生成未配置，请在设置页填入 provider 和 API key')
  }

  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
  }

  const finalPrompt = buildPromptWithRatio(input.prompt, input.aspectRatio)
  let base64: string

  if (settings.provider === 'google') {
    base64 = await generateWithGemini({
      prompt: finalPrompt,
      apiKey: settings.apiKey,
      model: settings.model || undefined,
    })
  } else if (settings.provider === 'openai') {
    base64 = await generateWithOpenAI({
      prompt: finalPrompt,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl || undefined,
      model: settings.model || undefined,
      size: ratioToSize(input.aspectRatio),
    })
  } else {
    throw new Error(`不支持的 image provider: ${settings.provider}`)
  }

  const filename = `${uuid()}.png`
  const filePath = join(OUTPUT_DIR, filename)
  await writeFile(filePath, Buffer.from(base64, 'base64'))

  return {
    imagePath: `/images/generated/${filename}`,
    filename,
    provider: settings.provider,
  }
}

export function hasImageConfig(): boolean {
  const s = getImageSettings()
  return !!(s?.provider && s.apiKey)
}
```

- [ ] **Step 4: Build 验证**

```bash
pnpm build
```

---

## Task 8: 图片生成 API 和设置 API

**Files:**
- Create: `src/app/api/studio/images/generate/route.ts`
- Create: `src/app/api/settings/ai-image/route.ts`

- [ ] **Step 1: 创建 `src/app/api/studio/images/generate/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateCoverImage, hasImageConfig } from '@/lib/studio/image-gen'

export async function GET() {
  return NextResponse.json({ configured: hasImageConfig() })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body?.prompt) {
    return NextResponse.json({ error: '缺少 prompt' }, { status: 400 })
  }
  try {
    const result = await generateCoverImage({
      prompt: body.prompt,
      aspectRatio: body.aspectRatio,
    })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 2: 创建 `src/app/api/settings/ai-image/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { aiSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function mask(key: string): string {
  if (!key || key.length < 10) return key ? '***' : ''
  return `${key.slice(0, 6)}***${key.slice(-4)}`
}

export async function GET() {
  const row = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).get()
  if (!row) {
    return NextResponse.json({ provider: '', baseUrl: '', apiKey: '', model: '' })
  }
  return NextResponse.json({
    provider: row.imageProvider || '',
    baseUrl: row.imageBaseUrl || '',
    apiKey: mask(row.imageApiKey || ''),
    model: row.imageModel || '',
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    provider?: string
    baseUrl?: string
    apiKey?: string
    model?: string
  }
  const now = new Date().toISOString()

  const existing = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).get()
  if (!existing) {
    // 创建默认行（provider 必须有值，先用 'anthropic' 之类的默认）
    await db.insert(aiSettings).values({
      id: 'default',
      provider: 'anthropic',
      fastModel: 'claude-haiku-4-5-20251001',
      qualityModel: 'claude-sonnet-4-6',
      imageProvider: body.provider || '',
      imageBaseUrl: body.baseUrl || '',
      imageApiKey: body.apiKey || '',
      imageModel: body.model || '',
      updatedAt: now,
    })
  } else {
    const newKey = body.apiKey && !body.apiKey.includes('***') ? body.apiKey : existing.imageApiKey
    await db.update(aiSettings).set({
      imageProvider: body.provider ?? existing.imageProvider,
      imageBaseUrl: body.baseUrl ?? existing.imageBaseUrl,
      imageApiKey: newKey,
      imageModel: body.model ?? existing.imageModel,
      updatedAt: now,
    }).where(eq(aiSettings.id, 'default'))
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

---

## Task 9: 前端配图对话框

**Files:**
- Create: `src/components/studio/image-generate-dialog.tsx`
- Modify: `src/components/studio/studio-page.tsx`

- [ ] **Step 1: 创建 `src/components/studio/image-generate-dialog.tsx`**

```typescript
"use client"

import { useState, useEffect } from 'react'
import { X, Loader2, Copy, Download, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageGenerateDialogProps {
  defaultPrompt?: string
  onClose: () => void
}

type Ratio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

export function ImageGenerateDialog({ defaultPrompt = '', onClose }: ImageGenerateDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [ratio, setRatio] = useState<Ratio>('16:9')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ imagePath: string; filename: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: ratio }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || '生成失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    const markdownSnippet = `![封面图](${result.imagePath})`
    navigator.clipboard.writeText(markdownSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="font-serif-display text-lg font-semibold flex items-center gap-2">
            <ImageIcon className="size-4 text-[var(--color-warm-accent)]" />
            生成配图
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">描述</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="描述你想要的封面图..."
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:border-[var(--color-warm-accent)] resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">比例</label>
            <div className="flex gap-1.5">
              {(['1:1', '16:9', '9:16', '4:3', '3:4'] as Ratio[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    ratio === r
                      ? 'bg-[var(--color-warm-accent)] text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
            {generating ? '生成中...' : '生成'}
          </button>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 p-2 rounded-md bg-red-500/10">{error}</div>
          )}

          {result && (
            <div className="space-y-2">
              <img src={result.imagePath} alt="生成结果" className="w-full rounded-lg border border-border/60" />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="size-3" />
                  {copied ? '已复制 Markdown' : '复制 Markdown 链接'}
                </button>
                <a
                  href={result.imagePath}
                  download={result.filename}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-3" />
                  下载
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/components/studio/studio-page.tsx` 集成**

在 import 区加入：
```typescript
import { ImageGenerateDialog } from './image-generate-dialog'
import { Image as ImageIcon } from 'lucide-react'  // 可能已有，留意重复
```

在 state 加入：
```typescript
const [showImageDialog, setShowImageDialog] = useState(false)
const [imageConfigured, setImageConfigured] = useState(false)

useEffect(() => {
  fetch('/api/studio/images/generate').then(r => r.json()).then(d => {
    setImageConfigured(!!d.configured)
  }).catch(() => setImageConfigured(false))
}, [])
```

在底部操作栏的「分享卡片」按钮旁边加入：
```tsx
{imageConfigured && (
  <button
    onClick={() => setShowImageDialog(true)}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
  >
    <ImageIcon className="size-3.5" />
    <span>配图</span>
  </button>
)}
```

在组件 return 的最下面（其他弹窗之后）加入：
```tsx
{showImageDialog && (
  <ImageGenerateDialog
    defaultPrompt={draft.title ? `生成一张符合文章主题的封面图：${draft.title}` : ''}
    onClose={() => setShowImageDialog(false)}
  />
)}
```

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

---

## Task 10: Settings 页面图像生成配置 UI

**Files:**
- Modify: `src/app/settings/page.tsx`（或对应子组件）

- [ ] **Step 1: 读取现有 settings page 结构**

先 Read `src/app/settings/page.tsx`，了解它现有的 Tab / 卡片布局（交接文档说是"左侧菜单 + 右侧内容"）。

- [ ] **Step 2: 在"模型"设置区块下方新增一个子区块「图片生成（可选）」**

字段布局（和现有 AI model settings 一致的风格）：
- Provider 下拉：`''`（未配置）/ `google`（Gemini）/ `openai`（OpenAI 兼容）
- Base URL（仅 openai 时显示）
- API Key（密码输入，支持脱敏显示）
- Model（默认值根据 provider 提示：google 填 `gemini-2.5-flash-image-preview`，openai 填 `gpt-image-1`）

提交使用 `PATCH /api/settings/ai-image`。

UI 代码参考现有 `/api/settings` 的使用方式（从 settings page 里找类似的 fetch + form）。如果 settings page 结构很复杂难改，最小方案：
- 在 settings page 的模型设置区块顶部加一个链接「配置图片生成 →」
- 链接打开一个 Dialog 组件 `src/components/settings/ai-image-settings-dialog.tsx`
- Dialog 内做独立表单，通过 PATCH API 提交

**最终要能让用户配置上 provider + API key，保存后可以在 Studio 里看到「配图」按钮出现。**

- [ ] **Step 3: Build 验证**

```bash
pnpm build
```

- [ ] **Step 4: Commit D5**

```bash
git add -A && git commit -m "功能：D5 Studio 配图生成（Gemini/OpenAI provider + 前端对话框 + 设置入口）"
```

---

## Task 11: 资源目录与 gitignore

- [ ] **Step 1: 创建 `public/images/generated/` 目录**

```bash
mkdir -p /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia/public/images/generated
```

- [ ] **Step 2: 创建 `.gitkeep` 占位**

```bash
touch /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia/public/images/generated/.gitkeep
```

- [ ] **Step 3: 追加 `.gitignore` 规则**

在 `.gitignore` 末尾加入：

```
# 生成的图片（仅保留目录）
public/images/generated/*
!public/images/generated/.gitkeep
```

- [ ] **Step 4: Commit 资源配置**

```bash
git add -A && git commit -m "配置：Studio 生成图片目录 + gitignore 规则"
```

---

## Task 12: 收尾验证

- [ ] **Step 1: 全量 build**

```bash
pnpm build
```

- [ ] **Step 2: 全量 test**

```bash
pnpm test
```

- [ ] **Step 3: 验证 DB 变更已应用**

```bash
sqlite3 data/automedia.db ".schema draft_versions"
sqlite3 data/automedia.db ".schema ai_settings" | grep image_
```
Expected: draft_versions 表存在；ai_settings 里有 image_provider / image_base_url / image_api_key / image_model 字段。

- [ ] **Step 4: 最终 Commit（如果有未提交变更）**

```bash
git status
git add -A && git commit -m "Spec 2：Studio 写作体验补齐完成（build + test 通过）" || echo "no changes"
```

---

## Self-Review

**Spec 覆盖：**
- D2 版本历史 → Task 1, 3, 4, 5 ✓
- D4 预览升级 → Task 2, 6 ✓
- D5 配图生成 → Task 1, 7, 8, 9, 10, 11 ✓

**Placeholder：** Task 10 的 settings UI 有灵活降级方案（dialog 形式），但不是 TBD，是给出两个可选路径。

**类型一致性：** `VersionSource`、`DraftVersion`、`GenerateCoverImageResult` 在各文件间一致。

**范围：** 1 新表 + 4 字段 + ~13 新文件 + ~5 修改 + 3 个依赖。规模可控。

# Studio 语气润色 + 自由写作 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Studio 编辑器增加浮动润色工具栏（选中文本 → AI 改写）和空白写作入口（无需素材直接开写）

**Architecture:** D3 在 draft-editor 层新增选中检测 + 浮动工具栏组件，通过新 API 调用 AI 改写；D1 在 studio-page 顶部加「新建」按钮，generator 增加无素材分支用已有内容做润色扩写

**Tech Stack:** React 19, Vercel AI SDK (`generateObject`), Tailwind CSS, textarea selection API

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/components/studio/polish-toolbar.tsx` | 新建 | 浮动润色工具栏 UI + API 调用 |
| `src/components/studio/draft-editor.tsx` | 修改 | 集成选中检测 + 渲染工具栏 |
| `src/app/api/studio/polish/route.ts` | 新建 | 润色 API 端点 |
| `src/components/studio/studio-page.tsx` | 修改 | 新建按钮 + 生成按钮逻辑调整 |
| `src/lib/studio/generator.ts` | 修改 | 无素材生成分支 |

---

### Task 1: 润色 API 端点

**Files:**
- Create: `src/app/api/studio/polish/route.ts`

- [ ] **Step 1: 创建润色 API**

```ts
// src/app/api/studio/polish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModels } from '@/lib/ai/client'

const TONE_PROMPTS: Record<string, string> = {
  casual: '改写为更口语化、自然的表达，像朋友之间聊天的语气',
  formal: '改写为更正式、专业的书面表达',
  concise: '精简表达，删除冗余词句，保留核心意思',
  expand: '丰富表达，补充细节和过渡，让内容更饱满',
}

const PLATFORM_HINTS: Record<string, string> = {
  xhs: '当前平台是小红书，风格活泼亲切',
  twitter: '当前平台是 Twitter，风格简洁有力',
  article: '当前平台是公众号长文，风格专业有深度',
}

export async function POST(req: NextRequest) {
  try {
    const { text, tone, platform, context } = await req.json()
    if (!text || !tone) {
      return NextResponse.json({ error: '缺少 text 或 tone' }, { status: 400 })
    }

    const toneInstruction = TONE_PROMPTS[tone]
    if (!toneInstruction) {
      return NextResponse.json({ error: `不支持的 tone: ${tone}` }, { status: 400 })
    }

    const systemPrompt = [
      '你是一位专业的中文编辑。用户会给你一段文本，你需要按照指定方向改写。',
      '只返回改写后的文本，不要解释、不要加引号、不要加前缀。',
      PLATFORM_HINTS[platform] || '',
    ].filter(Boolean).join('\n')

    const userPrompt = [
      `改写方向：${toneInstruction}`,
      context ? `上下文（仅供理解语境，不要改写这部分）：\n${context}` : '',
      `需要改写的文本：\n${text}`,
    ].filter(Boolean).join('\n\n')

    const { text: result } = await generateText({
      model: getModels().fast,
      system: systemPrompt,
      prompt: userPrompt,
    })

    return NextResponse.json({ result: result.trim() })
  } catch (err) {
    console.error('[polish] error:', err)
    return NextResponse.json({ error: '润色失败' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 验证 API 可构建**

Run: `pnpm build`
Expected: 构建通过

- [ ] **Step 3: 提交**

```bash
git add src/app/api/studio/polish/route.ts
git commit -m "功能：Studio 润色 API（POST /api/studio/polish）"
```

---

### Task 2: 浮动润色工具栏组件

**Files:**
- Create: `src/components/studio/polish-toolbar.tsx`

- [ ] **Step 1: 创建工具栏组件**

```tsx
// src/components/studio/polish-toolbar.tsx
"use client"

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PolishToolbarProps {
  /** 工具栏锚定位置（相对于编辑器容器） */
  position: { top: number; left: number }
  /** 当前选中的文本 */
  selectedText: string
  /** 选中文本前后的上下文 */
  context: string
  /** 当前平台 */
  platform: string
  /** 润色完成回调，传回替换文本 */
  onPolished: (result: string) => void
  /** 关闭工具栏 */
  onClose: () => void
}

const TONES = [
  { key: 'casual', label: '口语化' },
  { key: 'formal', label: '正式' },
  { key: 'concise', label: '精简' },
  { key: 'expand', label: '扩展' },
] as const

export function PolishToolbar({ position, selectedText, context, platform, onPolished, onClose }: PolishToolbarProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handlePolish = async (tone: string) => {
    setLoading(tone)
    try {
      const res = await fetch('/api/studio/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, tone, platform, context }),
      })
      const data = await res.json()
      if (data.result) {
        onPolished(data.result)
      }
    } catch {
      // 静默失败，工具栏消失即可
    } finally {
      setLoading(null)
      onClose()
    }
  }

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-border/60 bg-card shadow-lg animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      {TONES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handlePolish(key)}
          disabled={loading !== null}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
            loading === key
              ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            loading !== null && loading !== key && 'opacity-40'
          )}
        >
          {loading === key ? <Loader2 className="size-3 animate-spin inline" /> : label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 验证可构建**

Run: `pnpm build`
Expected: 构建通过

- [ ] **Step 3: 提交**

```bash
git add src/components/studio/polish-toolbar.tsx
git commit -m "功能：浮动润色工具栏组件（PolishToolbar）"
```

---

### Task 3: 编辑器集成润色工具栏

**Files:**
- Modify: `src/components/studio/draft-editor.tsx`

- [ ] **Step 1: 修改 DraftEditor 集成选中检测 + 工具栏**

将 `draft-editor.tsx` 完整替换为以下内容：

```tsx
"use client"

import { useRef, useEffect, useState, useCallback } from 'react'
import { PolishToolbar } from './polish-toolbar'

interface DraftEditorProps {
  title: string
  content: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  platform: string
}

interface Selection {
  text: string
  start: number
  end: number
  position: { top: number; left: number }
  context: string
}

export function DraftEditor({ title, content, onTitleChange, onContentChange, platform }: DraftEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = 'auto'
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px'
    }
  }, [content])

  // 检测文本选中
  const handleSelectionChange = useCallback(() => {
    const textarea = bodyRef.current
    const container = containerRef.current
    if (!textarea || !container) return

    const { selectionStart, selectionEnd } = textarea
    if (selectionStart === selectionEnd || selectionStart === undefined) {
      setSelection(null)
      return
    }

    const selectedText = content.slice(selectionStart, selectionEnd)
    if (selectedText.trim().length < 4) {
      setSelection(null)
      return
    }

    // 计算工具栏位置：textarea 相对于容器的位置 + 光标大致位置
    const textareaRect = textarea.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // 用一个临时 span 测量选中起始位置的坐标
    const mirror = document.createElement('div')
    const style = window.getComputedStyle(textarea)
    mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:${style.width};font:${style.font};padding:${style.padding};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing};`
    mirror.textContent = content.slice(0, selectionStart)
    const marker = document.createElement('span')
    marker.textContent = '|'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)
    const markerRect = marker.getBoundingClientRect()
    const mirrorRect = mirror.getBoundingClientRect()
    document.body.removeChild(mirror)

    const top = textareaRect.top - containerRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop - 40
    const left = Math.min(
      Math.max(markerRect.left - mirrorRect.left, 0),
      containerRect.width - 280
    )

    // 上下文：选中文本前后各 200 字
    const ctxStart = Math.max(0, selectionStart - 200)
    const ctxEnd = Math.min(content.length, selectionEnd + 200)
    const context = content.slice(ctxStart, selectionStart) + '[SELECTED]' + content.slice(selectionEnd, ctxEnd)

    setSelection({ text: selectedText, start: selectionStart, end: selectionEnd, position: { top, left }, context })
  }, [content])

  // 润色完成：替换选中文本
  const handlePolished = (result: string) => {
    if (!selection) return
    const newContent = content.slice(0, selection.start) + result + content.slice(selection.end)
    onContentChange(newContent)
    setSelection(null)
  }

  const charCount = content.length
  const platformLimits: Record<string, { label: string; max: number }> = {
    xhs: { label: '小红书', max: 1000 },
    twitter: { label: 'Twitter', max: 280 },
    article: { label: '公众号', max: 5000 },
  }
  const limit = platformLimits[platform]

  return (
    <div className="h-full flex flex-col">
      {/* 编辑区域 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* 标题输入 */}
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="输入标题..."
            className="w-full text-2xl font-bold font-serif-display bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-6 leading-tight"
          />

          {/* 分隔线 */}
          <div className="w-12 h-0.5 bg-[var(--color-warm-accent)]/30 mb-6" />

          {/* 正文输入 */}
          <textarea
            ref={bodyRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onBlur={() => setTimeout(() => setSelection(null), 200)}
            placeholder="从这里开始写正文..."
            className="w-full min-h-[50vh] bg-transparent border-none outline-none resize-none text-base leading-[1.8] placeholder:text-muted-foreground/30"
          />
        </div>

        {/* 浮动润色工具栏 */}
        {selection && (
          <PolishToolbar
            position={selection.position}
            selectedText={selection.text}
            context={selection.context}
            platform={platform}
            onPolished={handlePolished}
            onClose={() => setSelection(null)}
          />
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-border/60 px-6 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          正文字数 {charCount}
          {limit && <span className="ml-1">/ {limit.max}</span>}
        </span>
        <span className="text-muted-foreground/50">Markdown 格式 · 选中文本可润色</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建通过

- [ ] **Step 3: 手动验证**

打开 Studio → 写一段文本 → 选中部分文字 → 确认浮动工具栏出现 → 点击「精简」→ 确认文本被替换

- [ ] **Step 4: 提交**

```bash
git add src/components/studio/draft-editor.tsx
git commit -m "功能：编辑器集成浮动润色工具栏（选中文本 → AI 改写）"
```

---

### Task 4: 自由写作 — 新建按钮 + 生成逻辑调整

**Files:**
- Modify: `src/components/studio/studio-page.tsx`

- [ ] **Step 1: 顶部工具栏添加「新建」按钮**

在 `studio-page.tsx` 的 import 中添加 `FilePlus`：

```diff
- import { PanelLeftOpen, PanelLeftClose, Eye, EyeOff, Sparkles, Copy, Image, Download, Loader2, History, RotateCcw } from 'lucide-react'
+ import { PanelLeftOpen, PanelLeftClose, Eye, EyeOff, Sparkles, Copy, Image, Download, Loader2, History, RotateCcw, FilePlus } from 'lucide-react'
```

在编辑器头部左侧按钮区域（`<History>` 按钮之后、版本历史按钮之前），添加新建按钮：

```tsx
              <button
                onClick={newDraft}
                className="p-1.5 rounded-md transition-colors hover:bg-muted text-muted-foreground"
                title="新建空白草稿"
              >
                <FilePlus className="size-4" />
              </button>
```

- [ ] **Step 2: 修改 AI 生成按钮逻辑**

将底部 AI 生成按钮的 `disabled` 条件和文案改为：

```tsx
            <button
              onClick={handleGenerate}
              disabled={generating || (draft.sourceIds.length === 0 && !draft.content.trim())}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              <span>{generating ? '生成中...' : draft.sourceIds.length > 0 ? 'AI 生成' : 'AI 润色'}</span>
            </button>
```

新逻辑：有素材 → 可生成；无素材但有内容 → 可润色；无素材无内容 → 禁用

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建通过

- [ ] **Step 4: 提交**

```bash
git add src/components/studio/studio-page.tsx
git commit -m "功能：Studio 新建空白草稿按钮 + 无素材时 AI 润色模式"
```

---

### Task 5: 自由写作 — Generator 无素材分支

**Files:**
- Modify: `src/lib/studio/generator.ts`

- [ ] **Step 1: 修改 generator 支持无素材生成**

将 `generator.ts` 中 `if (sources.length === 0) throw new Error(...)` 替换为无素材分支：

```ts
  // 无素材分支：基于已有内容润色扩写
  if (sources.length === 0) {
    if (!draft.content?.trim()) throw new Error('没有素材也没有内容，请先写点内容或添加素材')

    const stylePrompt = getStyleProfile(platform)

    const platformHints: Record<string, string> = {
      xhs: '小红书风格：活泼亲切，善用 emoji，段落短促有节奏感',
      twitter: 'Twitter 风格：精炼有力，观点鲜明，适合碎片化阅读',
      article: '公众号长文风格：结构清晰，论述有深度，专业但不枯燥',
    }

    const systemPrompt = [
      '你是一位专业的中文内容创作者。',
      platformHints[platform] || '',
      stylePrompt ? `用户的写作风格偏好：${stylePrompt}` : '',
      '基于用户已有的草稿内容，进行优化：改善结构、润色表达、补充细节。',
      '保持原文的核心观点和素材，不要凭空捏造事实。',
      '输出完整的优化后文本（Markdown 格式），不要解释你做了什么。',
    ].filter(Boolean).join('\n')

    snapshotDraft(draftId, 'pre_regenerate')

    const { text: result } = await generateText({
      model: getModels().quality,
      system: systemPrompt,
      prompt: `标题：${draft.title || '(无标题)'}\n\n正文：\n${draft.content}`,
    })

    const markdown = result.trim()
    updateDraft(draftId, {
      content: markdown,
      aiOriginal: markdown,
      aiPrompt: systemPrompt,
    })

    snapshotDraft(draftId, 'ai_generate')

    return { content: markdown, raw: { title: draft.title } }
  }
```

同时在文件顶部 import 中添加 `generateText`：

```diff
- import { generateObject } from 'ai'
+ import { generateObject, generateText } from 'ai'
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建通过

- [ ] **Step 3: 手动验证**

Studio → 新建空白草稿 → 写一段内容 → 点击「AI 润色」→ 确认内容被优化替换

- [ ] **Step 4: 提交**

```bash
git add src/lib/studio/generator.ts
git commit -m "功能：Generator 无素材分支（基于已有内容 AI 润色扩写）"
```

---

### Task 6: 最终验证 + 构建检查

- [ ] **Step 1: 全量构建**

Run: `pnpm build`
Expected: 构建通过

- [ ] **Step 2: 运行测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 3: 端到端验证**

1. 打开 Studio → 确认顶部有「新建」按钮（FilePlus 图标）
2. 点击新建 → 编辑器清空 → 底部按钮变为「AI 润色」
3. 写一段文本 → 选中部分 → 浮动工具栏出现
4. 点击「口语化」→ 选中文本被 AI 替换
5. 从日报进入 Studio（带素材）→ 底部按钮仍为「AI 生成」

- [ ] **Step 4: 提交（如有遗漏修复）**

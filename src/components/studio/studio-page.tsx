"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SourcePicker } from './source-picker'
import { DraftEditor } from './draft-editor'
import { PlatformSelector } from './platform-selector'
import type { Platform } from './platform-selector'
import { CardPreview } from './card-preview'
import { ExportDialog } from './export-dialog'
import { PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Loader2 } from 'lucide-react'

interface DraftState {
  id: string | null
  platform: Platform
  title: string
  content: string
  sourceIds: string[]
}

export function StudioPage() {
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<DraftState>({
    id: null,
    platform: 'xhs',
    title: '',
    content: '',
    sourceIds: [],
  })
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showCardPreview, setShowCardPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // 从 URL 参数初始化（日报页跳转过来时带 items 参数）
  useEffect(() => {
    const itemIds = searchParams.get('items')
    if (itemIds) {
      const ids = itemIds.split(',').filter(Boolean)
      setDraft(prev => ({ ...prev, sourceIds: ids }))
      setLeftOpen(true)
    }
  }, [searchParams])

  // 创建/更新草稿
  const saveDraft = async (): Promise<string | null> => {
    if (draft.id) {
      await fetch(`/api/studio/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.title, content: draft.content, platform: draft.platform }),
      })
      return draft.id
    } else {
      const res = await fetch('/api/studio/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: draft.platform, title: draft.title, content: draft.content, sourceItemIds: draft.sourceIds }),
      })
      const { id } = await res.json()
      setDraft(prev => ({ ...prev, id }))
      return id
    }
  }

  // AI 生成
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const draftId = await saveDraft()
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      })
      const data = await res.json()
      if (data.content) {
        setDraft(prev => ({ ...prev, content: data.content }))
      }
    } finally {
      setGenerating(false)
    }
  }

  // 复制到剪贴板
  const handleCopy = () => {
    navigator.clipboard.writeText(draft.content)
  }

  return (
    <div className="mx-auto max-w-[1400px] h-[calc(100vh-3.5rem)] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <button onClick={() => setLeftOpen(!leftOpen)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="素材面板">
            {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
          <PlatformSelector value={draft.platform} onChange={(p) => setDraft(prev => ({ ...prev, platform: p }))} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating || draft.sourceIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <span>✨</span>}
            <span>{generating ? '生成中...' : '生成'}</span>
          </button>
          <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors" title="复制 Markdown">📋</button>
          <button onClick={async () => { const id = await saveDraft(); if (id) setShowCardPreview(true) }} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors" title="生成卡片">🖼</button>
          <button onClick={async () => { const id = await saveDraft(); if (id) setShowExport(true) }} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors" title="导出">📤</button>
          <button onClick={() => setRightOpen(!rightOpen)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="预览面板">
            {rightOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
        </div>
      </div>

      {/* 主体三栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：素材面板 */}
        {leftOpen && (
          <div className="w-72 border-r border-border/60 overflow-y-auto shrink-0">
            <SourcePicker
              selectedIds={draft.sourceIds}
              onSelectionChange={(ids) => setDraft(prev => ({ ...prev, sourceIds: ids }))}
            />
          </div>
        )}

        {/* 中间：编辑器 */}
        <div className="flex-1 overflow-hidden">
          <DraftEditor
            content={draft.content}
            onChange={(content) => setDraft(prev => ({ ...prev, content }))}
          />
        </div>

        {/* 右侧：预览面板 */}
        {rightOpen && (
          <div className="w-80 border-l border-border/60 overflow-y-auto shrink-0 p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">预览</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: simpleMarkdownRender(draft.content) }} />
            </div>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {showCardPreview && draft.id && (
        <CardPreview draftId={draft.id} onClose={() => setShowCardPreview(false)} />
      )}
      {showExport && draft.id && (
        <ExportDialog draftId={draft.id} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}

// 简易 Markdown 渲染（预览面板用）
function simpleMarkdownRender(md: string): string {
  if (!md) return '<p class="text-muted-foreground">暂无内容，点击「生成」开始创作</p>'
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '<br><br>')
}

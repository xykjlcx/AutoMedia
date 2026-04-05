"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SourcePicker } from './source-picker'
import { DraftEditor } from './draft-editor'
import { PlatformSelector } from './platform-selector'
import { CardPreview } from './card-preview'
import { ExportDialog } from './export-dialog'
import { PanelLeftOpen, PanelLeftClose, Eye, EyeOff, Sparkles, Copy, Image, Download, Loader2, History, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DraftHistory } from './draft-history'
import { DraftVersions } from './draft-versions'
import { trackEvent } from '@/components/hooks/use-track-event'
import type { Platform } from './platform-selector'

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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [showCardPreview, setShowCardPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)

  // 页面访问埋点（仅首次 mount）
  useEffect(() => {
    trackEvent('visit_studio', 'page', '/studio')
  }, [])

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
      // 同时同步 sourceItemIds，否则用户保存后调整素材的操作不会持久化
      await fetch(`/api/studio/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          content: draft.content,
          platform: draft.platform,
          sourceItemIds: draft.sourceIds,
        }),
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
      // 新草稿创建后刷新历史列表
      setHistoryRefreshKey(k => k + 1)
      return id
    }
  }

  // 加载指定草稿到编辑器
  const loadDraft = async (id: string) => {
    const res = await fetch(`/api/studio/drafts/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setDraft({
      id: data.id,
      platform: data.platform as Platform,
      title: data.title ?? '',
      content: data.content ?? '',
      sourceIds: (data.sources ?? []).map((s: { itemId: string }) => s.itemId),
    })
    // 打开素材面板（如果有素材）
    if (data.sources?.length > 0) setLeftOpen(true)
  }

  // 新建空草稿
  const newDraft = () => {
    setDraft(prev => ({
      id: null,
      platform: prev.platform,
      title: '',
      content: '',
      sourceIds: [],
    }))
  }

  // 删除草稿后处理
  const handleDraftDeleted = (id: string) => {
    if (draft.id === id) newDraft()
    setHistoryRefreshKey(k => k + 1)
  }

  // AI 生成
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const draftId = await saveDraft()
      if (draftId) {
        trackEvent('generate_content', 'draft', draftId, { platform: draft.platform })
      }
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      })
      const data = await res.json()
      if (data.content) {
        setDraft(prev => ({ ...prev, content: data.content }))
      }
      if (data.raw?.title) {
        setDraft(prev => ({ ...prev, title: data.raw.title }))
      }
    } finally {
      setGenerating(false)
    }
  }

  // 复制到剪贴板
  const handleCopy = () => {
    const fullText = draft.title ? `# ${draft.title}\n\n${draft.content}` : draft.content
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      {/* 主体三栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 草稿历史抽屉 */}
        {historyOpen && (
          <DraftHistory
            currentDraftId={draft.id}
            onSelect={async (id) => { await loadDraft(id); setHistoryOpen(false) }}
            onNew={() => { newDraft(); setHistoryOpen(false) }}
            onDelete={handleDraftDeleted}
            refreshKey={historyRefreshKey}
            onClose={() => setHistoryOpen(false)}
          />
        )}

        {/* 版本历史抽屉 */}
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

        {/* 左侧：素材面板 */}
        {leftOpen && (
          <div className="w-72 border-r border-border/60 overflow-y-auto shrink-0 bg-card">
            <div className="px-3 py-3 border-b border-border/60 flex items-center justify-between">
              <span className="text-sm font-medium">素材库</span>
              <span className="text-xs text-muted-foreground">{draft.sourceIds.length} 篇已选</span>
            </div>
            <SourcePicker
              selectedIds={draft.sourceIds}
              onSelectionChange={(ids) => setDraft(prev => ({ ...prev, sourceIds: ids }))}
            />
          </div>
        )}

        {/* 中间：编辑器 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 编辑器头部 */}
          <div className="border-b border-border/60 px-4 py-2.5 flex items-center justify-between bg-card/50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  historyOpen ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'hover:bg-muted text-muted-foreground'
                )}
                title="草稿历史"
              >
                <History className="size-4" />
              </button>
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
              <button
                onClick={() => setLeftOpen(!leftOpen)}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  leftOpen ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'hover:bg-muted text-muted-foreground'
                )}
                title="素材面板"
              >
                {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>
              <div className="h-4 w-px bg-border/60" />
              <PlatformSelector value={draft.platform} onChange={(p) => setDraft(prev => ({ ...prev, platform: p }))} />
            </div>

            <button
              onClick={() => setRightOpen(!rightOpen)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                rightOpen ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {rightOpen ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              <span>预览</span>
            </button>
          </div>

          {/* 编辑器主体 */}
          <div className="flex-1 overflow-hidden">
            <DraftEditor
              title={draft.title}
              content={draft.content}
              onTitleChange={(title) => setDraft(prev => ({ ...prev, title }))}
              onContentChange={(content) => setDraft(prev => ({ ...prev, content }))}
              platform={draft.platform}
            />
          </div>

          {/* 底部操作栏 */}
          <div className="border-t border-border/60 px-4 py-2.5 flex items-center justify-between bg-card/50">
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <Copy className="size-3.5" />
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
              <button
                onClick={async () => {
                  const id = await saveDraft()
                  if (id) {
                    trackEvent('generate_card', 'draft', id, { platform: draft.platform })
                    setShowCardPreview(true)
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <Image className="size-3.5" />
                <span>分享卡片</span>
              </button>
              <button
                onClick={async () => {
                  const id = await saveDraft()
                  if (id) {
                    setShowExport(true)
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <Download className="size-3.5" />
                <span>导出</span>
              </button>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || draft.sourceIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              <span>{generating ? '生成中...' : 'AI 生成'}</span>
            </button>
          </div>
        </div>

        {/* 右侧：预览面板 */}
        {rightOpen && (
          <div className="w-80 border-l border-border/60 overflow-y-auto shrink-0 bg-card">
            <div className="px-4 py-3 border-b border-border/60">
              <span className="text-sm font-medium">预览</span>
            </div>
            <div className="p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {draft.title && <h1 className="text-xl font-bold font-serif-display mb-4">{draft.title}</h1>}
                {draft.content ? (
                  <div dangerouslySetInnerHTML={{ __html: simpleMarkdownRender(draft.content) }} />
                ) : (
                  <p className="text-muted-foreground/50 italic">暂无内容</p>
                )}
              </div>
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
  if (!md) return ''
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '<br><br>')
}

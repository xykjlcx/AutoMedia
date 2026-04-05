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

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId])

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

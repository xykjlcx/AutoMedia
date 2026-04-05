"use client"

import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { SOURCE_COLORS, SOURCE_META } from '@/lib/constants'
import { trackEvent } from '@/components/hooks/use-track-event'

interface Perspective {
  source: string
  stance: string
  keyPoints: string[]
}

interface CompareData {
  eventSummary: string
  perspectives: Perspective[]
  consensus: string
  disagreements: string
}

interface CompareModalProps {
  clusterId: string
  onClose: () => void
}

export function CompareModal({ clusterId, onClose }: CompareModalProps) {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 打开对比弹窗时上报
  useEffect(() => {
    trackEvent('view_compare', 'cluster', clusterId)
  }, [clusterId])

  // 拉取对比数据
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/insights/compare/${clusterId}`)
        if (!res.ok) throw new Error(`请求失败 (${res.status})`)
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clusterId])

  // ESC 关闭
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
          <h3 className="text-sm font-semibold text-foreground">多源对比分析</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="size-5 animate-spin text-[var(--color-warm-accent)]" />
              <span className="text-sm text-muted-foreground">AI 正在分析不同源的观点差异...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              {/* 事件概述 */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  事件概述
                </h4>
                <p className="text-sm text-foreground/80 leading-relaxed italic">
                  {data.eventSummary}
                </p>
              </div>

              {/* 各源视角 */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  各源视角 ({data.perspectives.length})
                </h4>
                <div className="space-y-3">
                  {data.perspectives.map((p, i) => {
                    const color = SOURCE_COLORS[p.source] || '#9C9590'
                    const meta = SOURCE_META[p.source]
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-border/60 bg-card p-3"
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium" style={{ color }}>
                            {meta?.icon} {meta?.name || p.source}
                          </span>
                          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                            {p.stance}
                          </span>
                        </div>
                        {p.keyPoints.length > 0 && (
                          <ul className="space-y-1">
                            {p.keyPoints.map((point, j) => (
                              <li key={j} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-1.5">
                                <span className="text-muted-foreground mt-0.5 shrink-0">-</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 共识与分歧 */}
              <div className="grid sm:grid-cols-2 gap-3">
                {data.consensus && (
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
                    <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
                      共识
                    </h4>
                    <p className="text-xs text-foreground/70 leading-relaxed">{data.consensus}</p>
                  </div>
                )}
                {data.disagreements && (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
                    <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
                      分歧
                    </h4>
                    <p className="text-xs text-foreground/70 leading-relaxed">{data.disagreements}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

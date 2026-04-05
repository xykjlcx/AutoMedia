"use client"

import { useEffect, useState } from 'react'
import { Lightbulb, RefreshCw, Loader2 } from 'lucide-react'

interface WeeklyInsight {
  weekStart: string
  weekEnd: string
  highlights: Array<{ title: string; insight: string; source: string }>
  observation: string
  keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
  generatedAt: string
}

export function WeeklyInsightCard() {
  const [data, setData] = useState<WeeklyInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insights/weekly')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/insights/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) await load()
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return null

  return (
    <div className="rounded-xl border border-[var(--color-warm-accent)]/20 bg-gradient-to-br from-[var(--color-warm-accent)]/5 to-transparent p-5 mb-10">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="size-4 text-[var(--color-warm-accent)]" />
            <h2 className="font-serif-display text-lg font-semibold text-foreground">本周洞察</h2>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground">{data.weekStart} — {data.weekEnd}</p>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          <span>{generating ? '生成中' : data ? '重新生成' : '生成'}</span>
        </button>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground italic">还没有本周洞察，点击右上「生成」按钮基于本周数据生成</p>
      ) : (
        <>
          <ol className="space-y-3 mb-4">
            {data.highlights.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 size-6 rounded-full bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] text-xs font-medium flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug mb-0.5">{h.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{h.insight}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">— {h.source}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="pt-3 mb-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground italic leading-relaxed">💡 {data.observation}</p>
          </div>
          {data.keyEntities.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">本周关键实体</p>
              <div className="flex flex-wrap gap-1.5">
                {data.keyEntities.map(e => (
                  <span key={e.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-foreground">
                    {e.name}
                    <span className="text-muted-foreground">·{e.mentionCount}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

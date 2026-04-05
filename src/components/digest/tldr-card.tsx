"use client"

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'

interface TldrData {
  digestDate: string
  headline: string
  items: Array<{ title: string; why: string; digestItemId: string }>
  observation: string
  generatedAt: string
}

export function TldrCard({ date }: { date: string }) {
  const [data, setData] = useState<TldrData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/digest/tldr?date=${date}`)
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

  useEffect(() => { load() }, [date])

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/digest/tldr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (res.ok) await load()
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) return null
  if (!data) return null

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-warm-accent)]/20 bg-gradient-to-br from-[var(--color-warm-accent)]/5 to-transparent p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--color-warm-accent)]" />
          <h3 className="font-serif-display text-base font-semibold text-foreground">今日三件事</h3>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="重新生成"
        >
          {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </button>
      </div>
      <p className="font-serif-display text-lg font-semibold text-foreground mb-4">{data.headline}</p>
      <ol className="space-y-3 mb-4">
        {data.items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 size-6 rounded-full bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] text-xs font-medium flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.why}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="pt-3 border-t border-border/40">
        <p className="text-xs text-muted-foreground italic leading-relaxed">💡 {data.observation}</p>
      </div>
    </div>
  )
}

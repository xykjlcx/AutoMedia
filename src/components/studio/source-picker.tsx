"use client"

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SOURCE_META } from '@/lib/constants'

interface DigestItemBrief {
  id: string
  title: string
  source: string
  oneLiner: string
}

interface SourcePickerProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export function SourcePicker({ selectedIds, onSelectionChange }: SourcePickerProps) {
  const [tab, setTab] = useState<'digest' | 'favorites'>('digest')
  const [items, setItems] = useState<DigestItemBrief[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      try {
        if (tab === 'digest') {
          const date = new Date().toISOString().slice(0, 10)
          const res = await fetch(`/api/digest/${date}`)
          const data = await res.json()
          const all = Object.values(data.groups || {}).flat() as DigestItemBrief[]
          setItems(all)
        } else {
          const res = await fetch('/api/favorites')
          const data = await res.json()
          setItems(data.map((f: { digestItem: DigestItemBrief }) => f.digestItem).filter(Boolean))
        }
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    fetchItems()
  }, [tab])

  const toggle = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    )
  }

  return (
    <div className="p-3">
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setTab('digest')}
          className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', tab === 'digest' ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted')}
        >
          今日日报
        </button>
        <button
          onClick={() => setTab('favorites')}
          className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', tab === 'favorites' ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted')}
        >
          收藏
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">加载中...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无内容</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const selected = selectedIds.includes(item.id)
            const meta = SOURCE_META[item.source]
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={cn(
                  'w-full text-left p-2 rounded-md text-xs transition-colors border',
                  selected ? 'border-[var(--color-warm-accent)]/40 bg-[var(--color-warm-accent)]/5' : 'border-transparent hover:bg-muted'
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn('size-4 rounded border flex items-center justify-center shrink-0 mt-0.5', selected ? 'bg-[var(--color-warm-accent)] border-[var(--color-warm-accent)]' : 'border-border')}>
                    {selected && <Check className="size-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {meta && <span>{meta.icon}</span>}
                      <span className="text-muted-foreground">{meta?.name}</span>
                    </div>
                    <p className="font-medium text-foreground line-clamp-2">{item.title}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock3, Trash2 } from 'lucide-react'
import { SOURCE_COLORS, SOURCE_META } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface QueueItem {
  id: string
  digestItemId: string
  addedAt: string
  expiresAt: string
  readAt: string | null
  title: string
  source: string
  url: string
  oneLiner: string
  digestDate: string
  aiScore: number
}

export function ReadingQueueList() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reading-queue')
      const json = await res.json()
      setItems(json.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleOpen = async (item: QueueItem) => {
    await fetch(`/api/reading-queue/${item.id}`, { method: 'PATCH' })
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/reading-queue/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) {
    return <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        <Clock3 className="size-8 mx-auto mb-3 opacity-40" />
        <p>还没有稍后读的文章</p>
        <p className="text-xs mt-1">在日报页点击「稍后读」按钮加入队列</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const now = Date.now()
        const expireTime = new Date(item.expiresAt).getTime()
        const hoursLeft = Math.max(0, Math.floor((expireTime - now) / 3600000))
        const expiringSoon = hoursLeft < 72
        const isRead = !!item.readAt
        const sourceMeta = SOURCE_META[item.source]
        const color = SOURCE_COLORS[item.source] || '#9C9590'

        return (
          <div
            key={item.id}
            className={cn(
              'group relative rounded-lg border border-border/60 bg-card p-4 transition-all hover:border-border',
              isRead && 'opacity-50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                  <span className="inline-block size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span>{sourceMeta?.name || item.source}</span>
                  <span>·</span>
                  <span>{item.digestDate}</span>
                  {expiringSoon && (
                    <span className="text-orange-600 dark:text-orange-400">{hoursLeft}h 后过期</span>
                  )}
                </div>
                <Link
                  href={item.url}
                  target="_blank"
                  onClick={() => handleOpen(item)}
                  className="block"
                >
                  <h3 className="font-medium text-sm text-foreground group-hover:text-[var(--color-warm-accent)] transition-colors leading-snug mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.oneLiner}</p>
                </Link>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                title="移除"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

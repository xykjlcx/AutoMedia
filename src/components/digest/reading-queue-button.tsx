"use client"

import { useState } from 'react'
import { Clock3, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/components/hooks/use-track-event'

export function ReadingQueueButton({ digestItemId }: { digestItemId: string }) {
  const [inQueue, setInQueue] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  // 初始加载时不查询单条状态，点击时做 upsert，状态通过点击切换
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/reading-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digestItemId }),
      })
      if (res.ok) {
        setInQueue(true)
        trackEvent('add_to_reading_queue', 'digest_item', digestItemId)
        setTimeout(() => setInQueue(false), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
        inQueue
          ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      title={inQueue ? '已加入稍后读' : '加入稍后读'}
    >
      {inQueue ? <Check className="size-3" /> : <Clock3 className="size-3" />}
      <span>{inQueue ? '已加入' : '稍后读'}</span>
    </button>
  )
}

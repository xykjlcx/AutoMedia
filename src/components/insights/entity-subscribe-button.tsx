"use client"

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EntitySubscribeButton({ entityId }: { entityId: string }) {
  const [subscribed, setSubscribed] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 加载时查询订阅状态
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/entity-subscriptions')
      const json = await res.json()
      const found = (json.items || []).find((it: { entityId: string; id: string }) => it.entityId === entityId)
      if (found) {
        setSubscribed(true)
        setSubscriptionId(found.id)
      } else {
        setSubscribed(false)
        setSubscriptionId(null)
      }
    }
    load()
  }, [entityId])

  const toggle = async () => {
    if (loading) return
    setLoading(true)
    try {
      if (subscribed && subscriptionId) {
        await fetch(`/api/entity-subscriptions/${subscriptionId}`, { method: 'DELETE' })
        setSubscribed(false)
        setSubscriptionId(null)
      } else {
        const res = await fetch('/api/entity-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId }),
        })
        const json = await res.json()
        setSubscribed(true)
        setSubscriptionId(json.id)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
        subscribed
          ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      title={subscribed ? '取消订阅' : '订阅此实体'}
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : subscribed ? <Bell className="size-3" /> : <BellOff className="size-3" />}
      <span>{subscribed ? '已订阅' : '订阅'}</span>
    </button>
  )
}

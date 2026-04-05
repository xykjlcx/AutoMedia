"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, ArrowRight, Loader2, ExternalLink, Zap } from "lucide-react"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"

interface Alert {
  entityId: string
  entityName: string
  entityType: string
  sources: string[]
  firstSeenDate: string
  daysSinceFirstSeen: number
  mentionCount: number
  spreadPath: string
  articles: Array<{
    id: string
    title: string
    source: string
    url: string
  }>
}

function SourceDot({ source }: { source: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${SOURCE_COLORS[source] || '#9C9590'}15`,
        color: SOURCE_COLORS[source] || '#9C9590',
      }}
    >
      {SOURCE_META[source]?.icon} {SOURCE_META[source]?.name || source}
    </span>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false)
  // 传播速度评级
  const speedLabel = alert.daysSinceFirstSeen === 0
    ? "当日爆发"
    : alert.daysSinceFirstSeen <= 1
      ? "快速传播"
      : "持续发酵"

  const speedColor = alert.daysSinceFirstSeen === 0
    ? "text-red-500"
    : alert.daysSinceFirstSeen <= 1
      ? "text-orange-500"
      : "text-yellow-600 dark:text-yellow-400"

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[var(--color-warm-accent)]" />
            <h3 className="text-sm font-medium text-foreground">{alert.entityName}</h3>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
              {alert.entityType === 'person' ? '人物' :
               alert.entityType === 'company' ? '公司' :
               alert.entityType === 'product' ? '产品' : '技术'}
            </span>
          </div>
          <span className={`text-xs font-medium ${speedColor}`}>
            {speedLabel}
          </span>
        </div>

        {/* 传播路径 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {alert.sources.map((source, i) => (
            <span key={source} className="flex items-center gap-1">
              <SourceDot source={source} />
              {i < alert.sources.length - 1 && (
                <ArrowRight className="size-3 text-muted-foreground" />
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{alert.mentionCount} 次提及</span>
          <span>{alert.sources.length} 个源</span>
          <span>首次: {alert.firstSeenDate}</span>
        </div>

        {/* 相关文章 */}
        {alert.articles.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--color-warm-accent)] hover:text-[var(--color-warm-accent-hover)] mt-2 transition-colors"
          >
            {expanded ? '收起文章' : `查看 ${alert.articles.length} 篇相关文章`}
          </button>
        )}

        {expanded && (
          <div className="mt-2 space-y-1.5 animate-card-enter">
            {alert.articles.map(article => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group/link"
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: SOURCE_COLORS[article.source] || '#9C9590' }}
                />
                <span className="truncate flex-1">{article.title}</span>
                <ExternalLink className="size-3 shrink-0 opacity-0 group-hover/link:opacity-60" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CrossSourceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAlerts()
  }, [])

  async function fetchAlerts() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights/alerts?days=7')
      if (!res.ok) throw new Error(`请求失败: ${res.status}`)
      const json = await res.json()
      setAlerts(json.alerts)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 text-[var(--color-warm-accent)] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        暂无跨源预警。当同一话题在多个平台出现时，这里会提醒你。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <AlertCard key={alert.entityId} alert={alert} />
      ))}
    </div>
  )
}

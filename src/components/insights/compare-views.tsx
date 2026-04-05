"use client"

import { useState, useEffect } from "react"
import { GitCompareArrows, Loader2, ChevronDown, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"

interface Cluster {
  clusterId: string
  mainTitle: string
  sources: string[]
  itemCount: number
}

interface Perspective {
  source: string
  stance: string
  keyPoints: string[]
}

interface CompareResult {
  eventSummary: string
  perspectives: Perspective[]
  consensus: string
  disagreements: string
}

function ClusterCard({ cluster, onCompare }: {
  cluster: Cluster
  onCompare: () => void
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 transition-shadow hover:shadow-md">
      <h3 className="text-sm font-medium text-foreground mb-2 leading-snug">
        {cluster.mainTitle}
      </h3>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {cluster.sources.map(source => (
          <span
            key={source}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${SOURCE_COLORS[source] || '#9C9590'}15`,
              color: SOURCE_COLORS[source] || '#9C9590',
            }}
          >
            {SOURCE_META[source]?.icon} {SOURCE_META[source]?.name || source}
          </span>
        ))}
      </div>
      <button
        onClick={onCompare}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-warm-accent)] hover:text-[var(--color-warm-accent-hover)] font-medium transition-colors"
      >
        <GitCompareArrows className="size-3.5" />
        查看对比
      </button>
    </div>
  )
}

function CompareDetail({ clusterId, onClose }: {
  clusterId: string
  onClose: () => void
}) {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCompare()
  }, [clusterId])

  async function fetchCompare() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/insights/compare/${clusterId}`)
      if (!res.ok) throw new Error(`请求失败: ${res.status}`)
      const json = await res.json()
      setResult(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--color-warm-accent)]/20 bg-[var(--color-warm-accent)]/5 p-6 animate-card-enter">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="size-5 text-[var(--color-warm-accent)] animate-spin" />
          <span className="text-sm text-muted-foreground">AI 正在分析不同源的观点差异...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive animate-card-enter">
        {error}
        <button onClick={onClose} className="ml-3 underline">关闭</button>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="rounded-lg border border-[var(--color-warm-accent)]/20 bg-[var(--color-warm-accent)]/5 p-4 space-y-4 animate-card-enter">
      {/* 事件概述 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground/80 leading-relaxed italic">
            {result.eventSummary}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground shrink-0 ml-4"
        >
          关闭
        </button>
      </div>

      {/* 各源立场 */}
      <div className="space-y-3">
        {result.perspectives.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card p-3"
            style={{ borderLeftWidth: 3, borderLeftColor: SOURCE_COLORS[p.source] || '#9C9590' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-medium" style={{ color: SOURCE_COLORS[p.source] || '#9C9590' }}>
                {SOURCE_META[p.source]?.icon} {SOURCE_META[p.source]?.name || p.source}
              </span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {p.stance}
              </span>
            </div>
            <ul className="space-y-1">
              {p.keyPoints.map((point, j) => (
                <li key={j} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-1.5">
                  <span className="text-muted-foreground mt-0.5 shrink-0">-</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 共识与分歧 */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3">
          <h4 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
            共识
          </h4>
          <p className="text-xs text-foreground/70 leading-relaxed">{result.consensus}</p>
        </div>
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
          <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">
            分歧
          </h4>
          <p className="text-xs text-foreground/70 leading-relaxed">{result.disagreements}</p>
        </div>
      </div>
    </div>
  )
}

export function CompareViews() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)

  useEffect(() => {
    fetchClusters()
  }, [])

  async function fetchClusters() {
    setLoading(true)
    setError(null)
    try {
      // 查找最近的日报日期来获取聚类数据
      const datesRes = await fetch('/api/digest/dates')
      if (!datesRes.ok) throw new Error(`请求失败: ${datesRes.status}`)
      const { dates } = await datesRes.json() as { dates: string[] }

      if (dates.length === 0) {
        setClusters([])
        return
      }

      // 获取最近日期的日报数据
      const date = dates[0]
      const digestRes = await fetch(`/api/digest/${date}`)
      if (!digestRes.ok) throw new Error(`请求失败: ${digestRes.status}`)
      const digestData = await digestRes.json()

      // 从日报数据中提取多源聚类
      const items = Object.values(digestData.groups).flat() as Array<{
        clusterId: string | null
        clusterSources: string[] | null
        title: string
        source: string
      }>

      const multiSourceItems = items.filter(
        item => item.clusterSources && item.clusterSources.length > 0
      )

      setClusters(multiSourceItems.map(item => ({
        clusterId: item.clusterId!,
        mainTitle: item.title,
        sources: [item.source, ...(item.clusterSources || [])],
        itemCount: 1 + (item.clusterSources?.length || 0),
      })))
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

  if (clusters.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        暂无多源聚类。当同一事件在不同平台被报道时，这里会显示对比分析入口。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clusters.map(cluster => (
        <div key={cluster.clusterId} className="space-y-3">
          <ClusterCard
            cluster={cluster}
            onCompare={() => setSelectedClusterId(
              selectedClusterId === cluster.clusterId ? null : cluster.clusterId
            )}
          />
          {selectedClusterId === cluster.clusterId && (
            <CompareDetail
              clusterId={cluster.clusterId}
              onClose={() => setSelectedClusterId(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

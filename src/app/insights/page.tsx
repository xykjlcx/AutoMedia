"use client"

import { useState } from "react"
import { Lightbulb, Network, AlertTriangle, GitCompareArrows, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { EntityGraph } from "@/components/insights/entity-graph"
import { CrossSourceAlerts } from "@/components/insights/cross-source-alerts"
import { CompareViews } from "@/components/insights/compare-views"
import { useReadingPosition } from "@/components/hooks/use-reading-position"

export default function InsightsPage() {
  // 阅读位置记忆
  useReadingPosition("/insights", "")

  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<string | null>(null)

  // 手动触发实体提取
  async function handleManualExtract() {
    setExtracting(true)
    setExtractResult(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/insights/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      const data = await res.json()
      if (res.ok) {
        setExtractResult(`提取完成：${data.entityCount} 个新实体，${data.relationCount} 条关联`)
      } else {
        setExtractResult(`提取失败：${data.error}`)
      }
    } catch (err) {
      setExtractResult('请求失败')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-16">
      {/* 页面标题 */}
      <div className="py-6 text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          洞察
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          知识图谱、跨源预警、多视角对比
        </p>
      </div>

      <Separator className="mb-8" />

      {/* 手动提取入口 */}
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={handleManualExtract}
          disabled={extracting}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60 transition-colors"
        >
          {extracting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Lightbulb className="size-3.5" />
          )}
          {extracting ? '提取中...' : '提取今日实体'}
        </button>
        {extractResult && (
          <span className="ml-3 text-xs text-muted-foreground">{extractResult}</span>
        )}
      </div>

      {/* Section 1: 知识图谱 */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Network className="size-4 text-[var(--color-warm-accent)]" />
          <h2 className="font-serif-display text-lg font-semibold text-foreground">
            知识图谱
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          从文章中提取的关键实体及其关联关系
        </p>
        <EntityGraph />
      </section>

      <Separator className="mb-8" />

      {/* Section 2: 跨源预警 */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="size-4 text-[var(--color-warm-accent)]" />
          <h2 className="font-serif-display text-lg font-semibold text-foreground">
            破圈预警
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          检测从小众源传播到主流源的话题
        </p>
        <CrossSourceAlerts />
      </section>

      <Separator className="mb-8" />

      {/* Section 3: 对比日报 */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <GitCompareArrows className="size-4 text-[var(--color-warm-accent)]" />
          <h2 className="font-serif-display text-lg font-semibold text-foreground">
            对比日报
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          同一事件不同信息源的视角对比
        </p>
        <CompareViews />
      </section>
    </div>
  )
}

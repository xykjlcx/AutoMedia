"use client"

import { useState } from "react"
import { BarChart3, Loader2, TrendingUp, Eye, Sparkles } from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import { Separator } from "@/components/ui/separator"

interface Highlight {
  title: string
  insight: string
  source: string
}

interface SummaryStats {
  total: number
  sources: Record<string, number>
}

interface SummaryResult {
  type: string
  startDate: string
  endDate: string
  highlights: Highlight[]
  trends: string
  outlook: string
  stats: SummaryStats
}

// 来源 badge 颜色映射
const sourceColorMap: Record<string, string> = {
  github: "bg-[#6e40c9]/10 text-[#6e40c9]",
  juejin: "bg-[#1E80FF]/10 text-[#1E80FF]",
  zhihu: "bg-[#0066FF]/10 text-[#0066FF]",
  producthunt: "bg-[#DA552F]/10 text-[#DA552F]",
  hackernews: "bg-[#FF6600]/10 text-[#FF6600]",
  twitter: "bg-[#1DA1F2]/10 text-[#1DA1F2]",
  xiaohongshu: "bg-[#FE2C55]/10 text-[#FE2C55]",
  wechat: "bg-[#07C160]/10 text-[#07C160]",
}

function SourceBadge({ source }: { source: string }) {
  const colorClass = sourceColorMap[source.toLowerCase()] ?? "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {source}
    </span>
  )
}

export default function SummaryPage() {
  const [type, setType] = useState<"weekly" | "monthly">("weekly")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const today = format(new Date(), "yyyy-MM-dd")
      const res = await fetch(`/api/digest/summary?type=${type}&date=${today}`)
      if (!res.ok) throw new Error(`请求失败: ${res.status}`)
      const data: SummaryResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  // 计算当前选择的时间范围标签
  const today = new Date()
  const rangeLabel = type === "weekly"
    ? `${format(subDays(today, 6), "MM/dd")} – ${format(today, "MM/dd")}`
    : `${format(startOfMonth(today), "MM/dd")} – ${format(endOfMonth(today), "MM/dd")}`

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      {/* 页面标题 */}
      <div className="py-6 text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          汇总
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 生成的周期性资讯综述与趋势洞察
        </p>
      </div>

      <Separator className="mb-6" />

      {/* 控制区 */}
      <div className="flex items-center justify-between gap-4 mb-8">
        {/* 周/月 切换 */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
          {(["weekly", "monthly"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setResult(null); setError(null) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                type === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "weekly" ? "本周" : "本月"}
            </button>
          ))}
        </div>

        {/* 时间范围 + 生成按钮 */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">{rangeLabel}</span>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:bg-[var(--color-warm-accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? "生成中..." : "生成汇总"}
          </button>
        </div>
      </div>

      {/* 错误状态 */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-6">
          {error}
        </div>
      )}

      {/* 加载占位 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="size-8 text-[var(--color-warm-accent)] animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">AI 正在分析资讯，通常需要 15-30 秒...</p>
        </div>
      )}

      {/* 结果区 */}
      {result && !loading && (
        <div className="space-y-8 animate-card-enter">
          {/* 要闻 */}
          {result.highlights.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="size-4 text-[var(--color-warm-accent)]" />
                <h2 className="font-serif-display text-lg font-semibold text-foreground">要闻</h2>
                <span className="text-xs text-muted-foreground">{result.highlights.length} 条</span>
              </div>
              <div className="space-y-3">
                {result.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 bg-card px-4 py-3.5 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-medium text-foreground leading-snug flex-1">
                        {h.title}
                      </h3>
                      <SourceBadge source={h.source} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {h.insight}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 趋势分析 */}
          {result.trends && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="size-4 text-[var(--color-warm-accent)]" />
                <h2 className="font-serif-display text-lg font-semibold text-foreground">趋势分析</h2>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-4 py-3.5">
                <p className="text-sm text-foreground/80 leading-relaxed">{result.trends}</p>
              </div>
            </section>
          )}

          {/* 前瞻 */}
          {result.outlook && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Eye className="size-4 text-[var(--color-warm-accent)]" />
                <h2 className="font-serif-display text-lg font-semibold text-foreground">前瞻</h2>
              </div>
              <div className="rounded-lg border border-[var(--color-warm-accent)]/20 bg-[var(--color-warm-accent)]/5 px-4 py-3.5">
                <p className="text-sm text-foreground/80 leading-relaxed italic">{result.outlook}</p>
              </div>
            </section>
          )}

          {/* 统计 */}
          {result.stats.total > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-serif-display text-lg font-semibold text-foreground">统计</h2>
                <span className="text-xs text-muted-foreground">共 {result.stats.total} 条</span>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-4 py-4 space-y-3">
                {Object.entries(result.stats.sources)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const pct = Math.round((count / result.stats.total) * 100)
                    return (
                      <div key={source} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <SourceBadge source={source} />
                          <span className="text-muted-foreground tabular-nums">{count} 条 · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--color-warm-accent)]/60 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          )}

          {/* 时间范围标注 */}
          <p className="text-center text-xs text-muted-foreground">
            覆盖 {result.startDate} 至 {result.endDate}，共 {result.stats.total} 条精选资讯
          </p>
        </div>
      )}

      {/* 初始空状态 */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <BarChart3 className="size-8 text-muted-foreground" />
          </div>
          <h2 className="font-serif-display text-lg font-semibold text-foreground mb-1">
            点击生成汇总
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            AI 将分析{type === "weekly" ? "本周" : "本月"}的精选资讯，生成要闻摘要、趋势分析和前瞻展望
          </p>
        </div>
      )}
    </div>
  )
}

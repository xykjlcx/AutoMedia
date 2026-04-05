"use client"

import { useState, useEffect } from "react"
import {
  Activity,
  BookOpen,
  CalendarDays,
  TrendingUp,
  Target,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"

interface StatsData {
  period: { start: string; end: string }
  summary: {
    totalReads: number
    totalDays: number
    avgPerDay: number
    recommendHitRate: number
  }
  byDate: Array<{ date: string; count: number }>
  bySource: Array<{ source: string; count: number }>
  byHour: Array<{ hour: number; count: number }>
  topArticles: Array<{ title: string; source: string; readCount: number }>
}

type Period = "week" | "month"

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>("week")
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/stats?period=${period}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period])

  const isEmpty = !data || data.summary.totalReads === 0

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-16">
      {/* 页面标题 */}
      <div className="py-6 text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          数据
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          阅读统计与行为洞察
        </p>
      </div>

      <Separator className="mb-8" />

      {/* 周期选择 */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
          <button
            onClick={() => setPeriod("week")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              period === "week"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            本周
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              period === "month"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            本月
          </button>
        </div>
      </div>

      {loading && <DashboardSkeleton />}

      {!loading && isEmpty && <EmptyState />}

      {!loading && !isEmpty && data && (
        <div className="space-y-8">
          {/* 摘要卡片 */}
          <SummaryCards summary={data.summary} />

          {/* 每日阅读趋势 */}
          <DailyChart
            byDate={data.byDate}
            period={data.period}
            periodType={period}
          />

          {/* 来源分布 */}
          <SourceDistribution bySource={data.bySource} />

          {/* 小时分布 */}
          <HourlyHeatmap byHour={data.byHour} />

          {/* 热门文章 */}
          {data.topArticles.length > 0 && (
            <TopArticles articles={data.topArticles} />
          )}
        </div>
      )}
    </div>
  )
}

// ---- 摘要卡片 ----
function SummaryCards({
  summary,
}: {
  summary: StatsData["summary"]
}) {
  const cards = [
    {
      label: "总阅读量",
      value: summary.totalReads,
      icon: BookOpen,
      accent: true,
    },
    {
      label: "活跃天数",
      value: summary.totalDays,
      icon: CalendarDays,
      suffix: "天",
    },
    {
      label: "日均阅读",
      value: summary.avgPerDay,
      icon: TrendingUp,
      suffix: "篇",
    },
    {
      label: "推荐命中率",
      value: summary.recommendHitRate,
      icon: Target,
      suffix: "%",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "rounded-xl p-4 ring-1 ring-foreground/10 bg-card",
            card.accent && "ring-[var(--color-warm-accent)]/30"
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <card.icon
              className={cn(
                "size-4",
                card.accent
                  ? "text-[var(--color-warm-accent)]"
                  : "text-muted-foreground"
              )}
            />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <p
            className={cn(
              "font-serif-display text-2xl font-bold",
              card.accent ? "text-[var(--color-warm-accent)]" : "text-foreground"
            )}
          >
            {card.value}
            {card.suffix && (
              <span className="text-sm font-normal text-muted-foreground ml-0.5">
                {card.suffix}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}

// ---- 每日阅读条形图 ----
function DailyChart({
  byDate,
  period,
  periodType,
}: {
  byDate: StatsData["byDate"]
  period: StatsData["period"]
  periodType: Period
}) {
  // 填充空日期
  const dateMap = new Map(byDate.map((d) => [d.date, d.count]))
  const days: Array<{ date: string; count: number }> = []

  const start = new Date(period.start)
  const end = new Date(period.end)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0]
    days.push({ date: key, count: dateMap.get(key) || 0 })
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1)

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="size-4 text-[var(--color-warm-accent)]" />
        <h2 className="font-serif-display text-lg font-semibold text-foreground">
          每日阅读
        </h2>
      </div>
      <div className="rounded-xl p-4 ring-1 ring-foreground/10 bg-card">
        <div className="flex items-end gap-1 h-40">
          {days.map((day) => {
            const height = day.count > 0 ? (day.count / maxCount) * 100 : 0
            // 短日期标签
            const label = day.date.slice(5) // "04-01"
            const isToday = day.date === new Date().toISOString().split("T")[0]

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
                title={`${day.date}: ${day.count} 篇`}
              >
                {/* 数值 */}
                {day.count > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {day.count}
                  </span>
                )}
                {/* 柱子 */}
                <div className="w-full flex justify-center" style={{ height: '100%', alignItems: 'flex-end', display: 'flex' }}>
                  <div
                    className={cn(
                      "w-full max-w-8 rounded-t-sm transition-all",
                      isToday
                        ? "bg-[var(--color-warm-accent)]"
                        : "bg-[var(--color-warm-accent)]/40"
                    )}
                    style={{
                      height: height > 0 ? `${Math.max(height, 4)}%` : "2px",
                    }}
                  />
                </div>
                {/* 日期标签 - 周视图全显示，月视图每 5 天显示 */}
                <span className={cn(
                  "text-[9px] text-muted-foreground truncate w-full text-center",
                  periodType === "month" && !label.endsWith("01") && !label.endsWith("05") && !label.endsWith("10") && !label.endsWith("15") && !label.endsWith("20") && !label.endsWith("25") && "invisible"
                )}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ---- 来源分布 ----
function SourceDistribution({
  bySource,
}: {
  bySource: StatsData["bySource"]
}) {
  const maxCount = Math.max(...bySource.map((s) => s.count), 1)

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="size-4 text-[var(--color-warm-accent)]" />
        <h2 className="font-serif-display text-lg font-semibold text-foreground">
          来源分布
        </h2>
      </div>
      <div className="rounded-xl p-4 ring-1 ring-foreground/10 bg-card space-y-3">
        {bySource.map((item) => {
          const color = SOURCE_COLORS[item.source] || "#9C9590"
          const meta = SOURCE_META[item.source]
          const pct = (item.count / maxCount) * 100

          return (
            <div key={item.source} className="flex items-center gap-3">
              <span className="text-sm w-24 truncate shrink-0 text-foreground">
                {meta?.icon} {meta?.name || item.source}
              </span>
              <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: color,
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-foreground w-10 text-right shrink-0">
                {item.count}
              </span>
            </div>
          )
        })}
        {bySource.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无数据
          </p>
        )}
      </div>
    </section>
  )
}

// ---- 小时分布热力图 ----
function HourlyHeatmap({ byHour }: { byHour: StatsData["byHour"] }) {
  // 构建完整 24 小时数据
  const hourMap = new Map(byHour.map((h) => [h.hour, h.count]))
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourMap.get(i) || 0,
  }))

  const maxCount = Math.max(...hours.map((h) => h.count), 1)

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="size-4 text-[var(--color-warm-accent)]" />
        <h2 className="font-serif-display text-lg font-semibold text-foreground">
          阅读时段
        </h2>
      </div>
      <div className="rounded-xl p-4 ring-1 ring-foreground/10 bg-card">
        <div className="grid grid-cols-12 gap-1.5 sm:grid-cols-24">
          {hours.map((h) => {
            const intensity = h.count > 0 ? h.count / maxCount : 0
            // 从透明到暖色点缀
            const opacity = intensity > 0 ? 0.2 + intensity * 0.8 : 0.05

            return (
              <div
                key={h.hour}
                className="flex flex-col items-center gap-1"
                title={`${h.hour}:00 — ${h.count} 篇`}
              >
                <div
                  className="w-full aspect-square rounded-sm"
                  style={{
                    backgroundColor: `var(--color-warm-accent)`,
                    opacity,
                  }}
                />
                <span className="text-[8px] text-muted-foreground">
                  {h.hour}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          颜色越深表示该时段阅读量越多
        </p>
      </div>
    </section>
  )
}

// ---- 热门文章 ----
function TopArticles({
  articles,
}: {
  articles: StatsData["topArticles"]
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-4 text-[var(--color-warm-accent)]" />
        <h2 className="font-serif-display text-lg font-semibold text-foreground">
          热门文章
        </h2>
      </div>
      <div className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border/60">
        {articles.map((article, i) => {
          const meta = SOURCE_META[article.source]
          const color = SOURCE_COLORS[article.source] || "#9C9590"

          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {article.title}
                </p>
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {meta?.name || article.source}
                </span>
              </div>
              <span className="text-xs font-medium text-[var(--color-warm-accent)] shrink-0">
                {article.readCount}次
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---- 空状态 ----
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Activity className="size-8 text-muted-foreground" />
      </div>
      <h2 className="font-serif-display text-lg font-semibold text-foreground mb-1">
        暂无阅读数据
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        开始阅读日报后，你的阅读统计将在这里展示
      </p>
    </div>
  )
}

// ---- 加载骨架 ----
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

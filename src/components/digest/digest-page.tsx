"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { Newspaper, Sparkles, List } from "lucide-react"
import { DateNav } from "@/components/digest/date-nav"
import { DigestTrigger } from "@/components/digest/digest-trigger"
import { SourceGroup } from "@/components/digest/source-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { DigestItem } from "@/components/digest/digest-card"

interface DigestData {
  date: string
  groups: Record<string, DigestItem[]>
  availableDates: string[]
}

// 来源排序优先级
const SOURCE_ORDER = ["github", "hackernews", "producthunt", "juejin", "zhihu"]

type TabKey = "recommended" | "all"

export function DigestPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateParam = searchParams.get("date") || format(new Date(), "yyyy-MM-dd")
  const [currentDate, setCurrentDate] = useState(dateParam)
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("recommended")

  const fetchDigest = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/digest/${date}`)
      const json: DigestData = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDigest(currentDate)
  }, [currentDate, fetchDigest])

  useEffect(() => {
    setCurrentDate(dateParam)
  }, [dateParam])

  const handleDateChange = (date: string) => {
    setCurrentDate(date)
    router.push(`/?date=${date}`, { scroll: false })
  }

  const handleGenerateComplete = () => {
    fetchDigest(currentDate)
  }

  // 根据当前 Tab 过滤数据
  const filteredGroups: Record<string, DigestItem[]> = {}
  if (data) {
    for (const [source, items] of Object.entries(data.groups)) {
      const filtered = activeTab === "recommended"
        ? items.filter(item => item.isRecommended !== false)
        : items
      if (filtered.length > 0) {
        filteredGroups[source] = filtered
      }
    }
  }

  const sortedSources = Object.keys(filteredGroups).sort((a, b) => {
    const ia = SOURCE_ORDER.indexOf(a)
    const ib = SOURCE_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  // 统计
  const allItems = data ? Object.values(data.groups).flat() : []
  const totalAll = allItems.length
  const totalRecommended = allItems.filter(i => i.isRecommended !== false).length
  const hasDigest = totalAll > 0
  const currentTotal = sortedSources.reduce((sum, s) => sum + (filteredGroups[s]?.length || 0), 0)
  const unreadCount = sortedSources.reduce(
    (sum, s) => sum + (filteredGroups[s]?.filter(item => item.isRead !== true).length || 0),
    0
  )

  let runningIndex = 0

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      <DateNav
        currentDate={currentDate}
        availableDates={data?.availableDates || []}
        onDateChange={handleDateChange}
      />

      <Separator className="mb-6" />

      <DigestTrigger
        date={currentDate}
        onComplete={handleGenerateComplete}
        hasExistingDigest={hasDigest}
      />

      {loading && (
        <div className="space-y-4 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!loading && hasDigest && (
        <div className="mt-6">
          {/* Tab 切换 */}
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-muted/50 w-fit">
            <button
              onClick={() => setActiveTab("recommended")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === "recommended"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-3.5" />
              精选推荐
              <span className="text-xs opacity-60">{totalRecommended}</span>
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-3.5" />
              全部资讯
              <span className="text-xs opacity-60">{totalAll}</span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground mb-6">
            共 {currentTotal} 条，来自 {sortedSources.length} 个信息源
            {unreadCount > 0 && (
              <span className="ml-1 text-[var(--color-warm-accent)]">（{unreadCount} 条未读）</span>
            )}
          </p>

          {sortedSources.map(source => {
            const items = filteredGroups[source]
            const startIdx = runningIndex
            runningIndex += items.length
            return (
              <SourceGroup
                key={source}
                source={source}
                items={items}
                startIndex={startIdx}
              />
            )
          })}

          {sortedSources.length === 0 && activeTab === "recommended" && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              暂无推荐内容，试试切换到"全部资讯"查看
            </div>
          )}
        </div>
      )}

      {!loading && !hasDigest && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Newspaper className="size-8 text-muted-foreground" />
          </div>
          <h2 className="font-serif-display text-lg font-semibold text-foreground mb-1">
            今日尚无日报
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            点击上方按钮生成今日资讯日报，AI 会从多个信息源为你精选值得关注的内容
          </p>
        </div>
      )}
    </div>
  )
}

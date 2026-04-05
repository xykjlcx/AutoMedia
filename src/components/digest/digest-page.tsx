"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { Newspaper, Sparkles, List } from "lucide-react"
import { DateNav } from "@/components/digest/date-nav"
import { DigestTrigger } from "@/components/digest/digest-trigger"
import { DigestCard } from "@/components/digest/digest-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"
import { useReadingPosition } from "@/components/hooks/use-reading-position"
import { trackEvent } from "@/components/hooks/use-track-event"
import type { DigestItem } from "@/components/digest/digest-card"

interface DigestData {
  date: string
  groups: Record<string, DigestItem[]>
  availableDates: string[]
}

type TabKey = "recommended" | "all"

export function DigestPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateParam = searchParams.get("date") || format(new Date(), "yyyy-MM-dd")
  const [currentDate, setCurrentDate] = useState(dateParam)

  // 阅读位置记忆
  useReadingPosition("/", currentDate)
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("recommended")
  // 信息源筛选：null = 全部，string = 指定来源
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  // 多选模式
  const [selectMode, setSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

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

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sendToStudio = () => {
    const ids = Array.from(selectedItems)
    // 批量上报 send_to_studio 事件（每篇各一条）
    ids.forEach(id => trackEvent('send_to_studio', 'digest_item', id, { count: ids.length }))
    router.push(`/studio?items=${ids.join(',')}`)
  }

  // 全部条目（扁平化）
  const allItems = data ? Object.values(data.groups).flat() : []

  // 按 Tab 过滤
  const tabFiltered = activeTab === "recommended"
    ? allItems.filter(item => item.isRecommended !== false)
    : allItems

  // 按来源过滤
  const finalItems = selectedSource
    ? tabFiltered.filter(item => item.source === selectedSource)
    : tabFiltered

  // 按分数排序
  const sortedItems = [...finalItems].sort((a, b) => b.aiScore - a.aiScore)

  // 统计
  const totalAll = allItems.length
  const totalRecommended = allItems.filter(i => i.isRecommended !== false).length
  const hasDigest = totalAll > 0
  const unreadCount = sortedItems.filter(item => item.isRead !== true).length

  // 来源列表及计数（基于当前 Tab 过滤后的数据）
  const sourceCounts = new Map<string, number>()
  for (const item of tabFiltered) {
    sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1)
  }
  const availableSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1]) // 按数量降序

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
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
        <div className="grid grid-cols-2 gap-4 mt-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && hasDigest && (
        <div className="mt-6">
          {/* Tab 切换（滚动时固定） */}
          <div className="sticky top-14 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit">
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
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedItems(new Set()) }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              selectMode ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {selectMode ? '取消选择' : '选择文章'}
          </button>
          </div>
          {/* 小屏来源筛选（侧边栏替代） */}
          {availableSources.length > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 lg:hidden">
              <button
                onClick={() => setSelectedSource(null)}
                className={cn(
                  "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  selectedSource === null
                    ? "bg-[var(--color-warm-accent)] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                全部
              </button>
              {availableSources.map(([source, count]) => {
                const meta = SOURCE_META[source]
                return (
                  <button
                    key={source}
                    onClick={() => setSelectedSource(selectedSource === source ? null : source)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                      selectedSource === source
                        ? "bg-[var(--color-warm-accent)] text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {meta?.name || source} {count}
                  </button>
                )
              })}
            </div>
          )}
          </div>

          {/* 侧边栏 + 内容区 */}
          <div className="flex gap-6">
            {/* 左侧信息源筛选栏（固定） */}
            <aside className="w-44 shrink-0 hidden lg:block">
              <div className="sticky top-[7.5rem]">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  信息源
                </h3>
                <nav className="space-y-1">
                  {/* 全部 */}
                  <button
                    onClick={() => setSelectedSource(null)}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-sm transition-colors",
                      selectedSource === null
                        ? "bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span>全部来源</span>
                    <span className="text-xs opacity-60">{tabFiltered.length}</span>
                  </button>
                  {/* 各来源 */}
                  {availableSources.map(([source, count]) => {
                    const meta = SOURCE_META[source]
                    const color = SOURCE_COLORS[source] || "#9C9590"
                    return (
                      <button
                        key={source}
                        onClick={() => setSelectedSource(selectedSource === source ? null : source)}
                        className={cn(
                          "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-sm transition-colors",
                          selectedSource === source
                            ? "bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="inline-block size-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {meta?.name || source}
                        </span>
                        <span className="text-xs opacity-60 shrink-0 ml-2">{count}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </aside>

            {/* 右侧内容区 */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-4">
                共 {sortedItems.length} 条
                {selectedSource && <span>，来源：{SOURCE_META[selectedSource]?.name || selectedSource}</span>}
                {unreadCount > 0 && (
                  <span className="ml-1 text-[var(--color-warm-accent)]">（{unreadCount} 条未读）</span>
                )}
              </p>

              {/* 双列卡片网格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {sortedItems.map((item, i) => (
                  <DigestCard
                    key={item.id}
                    item={item}
                    index={i}
                    selectable={selectMode}
                    selected={selectedItems.has(item.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>

              {sortedItems.length === 0 && activeTab === "recommended" && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  暂无推荐内容，试试切换到"全部资讯"查看
                </div>
              )}
            </div>
          </div>
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

      {selectMode && selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg">
          <span className="text-sm text-muted-foreground">已选 {selectedItems.size} 篇</span>
          <button
            onClick={sendToStudio}
            className="px-4 py-1.5 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            发送到 Studio
          </button>
        </div>
      )}
    </div>
  )
}

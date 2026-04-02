"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { Newspaper } from "lucide-react"
import { DateNav } from "@/components/digest/date-nav"
import { DigestTrigger } from "@/components/digest/digest-trigger"
import { SourceGroup } from "@/components/digest/source-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import type { DigestItem } from "@/components/digest/digest-card"

interface DigestData {
  date: string
  groups: Record<string, DigestItem[]>
  availableDates: string[]
}

// 来源排序优先级
const SOURCE_ORDER = ["github", "hackernews", "producthunt", "juejin", "zhihu"]

export default function HomePage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateParam = searchParams.get("date") || format(new Date(), "yyyy-MM-dd")
  const [currentDate, setCurrentDate] = useState(dateParam)
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)

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

  // URL 同步
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

  // 将 groups 按指定顺序排列
  const sortedSources = data
    ? Object.keys(data.groups).sort((a, b) => {
        const ia = SOURCE_ORDER.indexOf(a)
        const ib = SOURCE_ORDER.indexOf(b)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })
    : []

  const hasDigest = sortedSources.length > 0
  const totalItems = sortedSources.reduce(
    (sum, s) => sum + (data?.groups[s]?.length || 0),
    0
  )

  // 计算每个分组的起始动画索引
  let runningIndex = 0

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      {/* 日期导航 */}
      <DateNav
        currentDate={currentDate}
        availableDates={data?.availableDates || []}
        onDateChange={handleDateChange}
      />

      <Separator className="mb-6" />

      {/* 生成按钮 */}
      <DigestTrigger
        date={currentDate}
        onComplete={handleGenerateComplete}
        hasExistingDigest={hasDigest}
      />

      {/* 加载态 */}
      {loading && (
        <div className="space-y-4 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* 有日报数据 */}
      {!loading && hasDigest && (
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-6">
            共 {totalItems} 条精选，来自 {sortedSources.length} 个信息源
          </p>
          {sortedSources.map(source => {
            const items = data!.groups[source]
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
        </div>
      )}

      {/* 空状态 */}
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

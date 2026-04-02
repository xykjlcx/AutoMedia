"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { parseISO, format, isSameDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"

export default function HistoryPage() {
  const router = useRouter()
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  // 获取可用日期列表
  useEffect(() => {
    async function fetchDates() {
      try {
        // 用今天日期查 API，仅取 availableDates
        const today = format(new Date(), "yyyy-MM-dd")
        const res = await fetch(`/api/digest/${today}`)
        const data = await res.json()
        setAvailableDates(data.availableDates || [])
      } catch {
        setAvailableDates([])
      } finally {
        setLoading(false)
      }
    }
    fetchDates()
  }, [])

  // 将可用日期转换为 Date 对象用于日历高亮
  const availableDateObjects = availableDates.map(d => parseISO(d))

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    setSelectedDate(date)
    const formatted = format(date, "yyyy-MM-dd")
    router.push(`/?date=${formatted}`)
  }

  // 检查日期是否有日报
  const hasDigest = (date: Date) => {
    return availableDateObjects.some(d => isSameDay(d, date))
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      {/* 页面标题 */}
      <div className="py-6 text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          历史日报
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          选择一个日期查看当天的资讯日报
        </p>
      </div>

      <Separator className="mb-8" />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-gentle-pulse text-sm text-muted-foreground">
            加载中...
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* 日历 */}
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={zhCN}
              modifiers={{
                hasDigest: availableDateObjects,
              }}
              modifiersClassNames={{
                hasDigest: "!bg-[var(--color-warm-accent)]/15 !text-[var(--color-warm-accent)] font-semibold",
              }}
              disabled={(date) => date > new Date()}
            />
          </div>

          {/* 日期列表 */}
          {availableDates.length > 0 && (
            <div className="mt-8 w-full max-w-sm">
              <h2 className="font-serif-display text-base font-semibold text-foreground mb-3">
                有日报的日期
              </h2>
              <div className="space-y-1.5">
                {availableDates.map(dateStr => {
                  const date = parseISO(dateStr)
                  return (
                    <button
                      key={dateStr}
                      onClick={() => router.push(`/?date=${dateStr}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-muted group"
                    >
                      <CalendarIcon className="size-4 text-muted-foreground group-hover:text-[var(--color-warm-accent)] transition-colors" />
                      <span className="font-medium text-foreground">
                        {format(date, "yyyy年M月d日 EEEE", { locale: zhCN })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 空状态 */}
          {availableDates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                暂无历史日报，去首页生成第一份吧
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

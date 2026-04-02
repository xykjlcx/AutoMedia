"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, addDays, subDays, parseISO, isToday, isSameDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface DateNavProps {
  currentDate: string // YYYY-MM-DD
  availableDates: string[]
  onDateChange: (date: string) => void
}

export function DateNav({ currentDate, availableDates, onDateChange }: DateNavProps) {
  const date = parseISO(currentDate)
  const isCurrentToday = isToday(date)

  // 格式化日期：2026年4月3日 · 星期五
  const displayDate = format(date, "yyyy年M月d日", { locale: zhCN })
  const weekday = format(date, "EEEE", { locale: zhCN })

  // 判断前后日期是否有日报
  const dateSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  )

  const handlePrev = () => {
    const prev = subDays(date, 1)
    onDateChange(format(prev, "yyyy-MM-dd"))
  }

  const handleNext = () => {
    if (isCurrentToday) return
    const next = addDays(date, 1)
    onDateChange(format(next, "yyyy-MM-dd"))
  }

  // 找到有数据的前一天和后一天（可选优化，当前简单地前后翻一天）
  const prevDate = format(subDays(date, 1), "yyyy-MM-dd")
  const nextDate = format(addDays(date, 1), "yyyy-MM-dd")
  const hasPrev = dateSet.has(prevDate) || dateSet.size === 0
  const hasNext = !isCurrentToday && (dateSet.has(nextDate) || dateSet.size === 0)

  return (
    <div className="flex items-center justify-center gap-4 py-6">
      <button
        onClick={handlePrev}
        className={cn(
          "p-2 rounded-lg transition-colors",
          "hover:bg-muted text-muted-foreground hover:text-foreground",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
        aria-label="前一天"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div className="text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {displayDate}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {weekday}
          {isCurrentToday && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] text-xs font-medium">
              今天
            </span>
          )}
        </p>
      </div>

      <button
        onClick={handleNext}
        disabled={isCurrentToday}
        className={cn(
          "p-2 rounded-lg transition-colors",
          "hover:bg-muted text-muted-foreground hover:text-foreground",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
        aria-label="后一天"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}

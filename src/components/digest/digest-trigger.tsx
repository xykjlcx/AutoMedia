"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface DigestTriggerProps {
  date: string
  onComplete: () => void
  /** 当前日报状态，如果已有日报则显示"重新生成" */
  hasExistingDigest?: boolean
}

type RunStatus = "none" | "collecting" | "processing" | "completed" | "failed"

interface StatusResponse {
  status: RunStatus
  progress?: Record<string, string> | null
  rawCount?: number
  filteredCount?: number
  errors?: Record<string, string> | null
}

export function DigestTrigger({ date, onComplete, hasExistingDigest }: DigestTriggerProps) {
  const [status, setStatus] = useState<RunStatus>("none")
  const [progress, setProgress] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/digest/status?date=${date}`)
        const data: StatusResponse = await res.json()
        setStatus(data.status)
        if (data.progress) setProgress(data.progress)

        if (data.status === "completed") {
          stopPolling()
          onComplete()
        } else if (data.status === "failed") {
          stopPolling()
          const errMsg = data.errors
            ? Object.values(data.errors).join("; ")
            : "生成失败"
          setError(errMsg)
        }
      } catch {
        // 网络错误继续轮询
      }
    }, 2000)
  }, [date, onComplete, stopPolling])

  const handleTrigger = async () => {
    setStatus("collecting")
    setProgress(null)
    setError(null)

    try {
      await fetch("/api/digest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      })
      startPolling()
    } catch {
      setStatus("failed")
      setError("请求失败，请检查网络")
    }
  }

  const isRunning = status === "collecting" || status === "processing"

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <button
        onClick={handleTrigger}
        disabled={isRunning}
        className={cn(
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
          "border border-[var(--color-warm-accent)]/30",
          isRunning
            ? "bg-[var(--color-warm-accent)]/5 text-[var(--color-warm-accent)] cursor-wait"
            : "bg-[var(--color-warm-accent)] text-white hover:bg-[var(--color-warm-accent-hover)] active:scale-[0.98]"
        )}
      >
        {isRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>生成中...</span>
          </>
        ) : (
          <>
            <RefreshCw className="size-4" />
            <span>{hasExistingDigest ? "重新生成日报" : "生成今日日报"}</span>
          </>
        )}
      </button>

      {/* 进度信息 */}
      {isRunning && progress && (
        <p className="animate-gentle-pulse text-xs text-muted-foreground text-center">
          {progress.detail || '处理中...'}
        </p>
      )}

      {isRunning && !progress && (
        <p className="animate-gentle-pulse text-xs text-muted-foreground">
          正在采集信息源...
        </p>
      )}

      {/* 完成提示 */}
      {status === "completed" && (
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="size-4" />
          <span>生成完成</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

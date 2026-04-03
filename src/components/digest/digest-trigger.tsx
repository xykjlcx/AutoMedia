"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Check, Circle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface DigestTriggerProps {
  date: string
  onComplete: () => void
  /** 当前日报状态，如果已有日报则显示"重新生成" */
  hasExistingDigest?: boolean
}

type RunStatus = "none" | "collecting" | "processing" | "completed" | "failed"

// ── 结构化进度类型 ──

interface SourceProgress {
  status: "pending" | "running" | "done" | "error"
  name: string
  icon: string
  count?: number
  duration?: number
  error?: string
}

interface PipelineProgress {
  phase: "collecting" | "scoring" | "clustering" | "summarizing" | "completed" | "failed"
  sources?: Record<string, SourceProgress>
  scoring?: { total: number; done: number; filtered: number }
  clustering?: { total: number; done: number }
  summarizing?: { total: number; done: number }
  detail?: string
}

interface StatusResponse {
  status: RunStatus
  progress?: PipelineProgress | null
  rawCount?: number
  filteredCount?: number
  errors?: Record<string, string> | null
}

// ── 步骤条定义 ──

const PHASES = [
  { key: "collecting", label: "采集" },
  { key: "scoring", label: "评分" },
  { key: "clustering", label: "去重" },
  { key: "summarizing", label: "摘要" },
  { key: "completed", label: "完成" },
] as const

type PhaseKey = typeof PHASES[number]["key"]

function getPhaseIndex(phase?: string): number {
  return PHASES.findIndex(p => p.key === phase)
}

// ── 步骤条组件 ──

function StepBar({ currentPhase }: { currentPhase?: string }) {
  const currentIndex = getPhaseIndex(currentPhase)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto">
      {PHASES.map((phase, i) => {
        const isDone = currentIndex > i || currentPhase === "completed"
        const isCurrent = currentIndex === i && currentPhase !== "completed" && currentPhase !== "failed"

        return (
          <div key={phase.key} className="flex items-center">
            {/* 圆点 */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all border",
                  isDone && "bg-[var(--color-warm-accent)] border-[var(--color-warm-accent)] text-white",
                  isCurrent && "border-[var(--color-warm-accent)] text-[var(--color-warm-accent)] bg-[var(--color-warm-accent)]/10 animate-pulse",
                  !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground/50 bg-transparent",
                )}
              >
                {isDone ? <Check className="size-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none whitespace-nowrap",
                  isDone && "text-[var(--color-warm-accent)]",
                  isCurrent && "text-[var(--color-warm-accent)] font-medium",
                  !isDone && !isCurrent && "text-muted-foreground/50",
                )}
              >
                {phase.label}
              </span>
            </div>
            {/* 连接线 */}
            {i < PHASES.length - 1 && (
              <div
                className={cn(
                  "w-6 h-px mx-1 mt-[-14px]",
                  currentIndex > i ? "bg-[var(--color-warm-accent)]" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 源状态列表 ──

function SourceList({ sources }: { sources: Record<string, SourceProgress> }) {
  const entries = Object.entries(sources)
  if (entries.length === 0) return null

  return (
    <div className="w-full max-w-xs mx-auto space-y-1">
      {entries.map(([id, src]) => (
        <div key={id} className="flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* 状态图标 */}
            {src.status === "done" && (
              <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
            )}
            {src.status === "running" && (
              <Loader2 className="size-3.5 text-[var(--color-warm-accent)] animate-spin shrink-0" />
            )}
            {src.status === "error" && (
              <AlertCircle className="size-3.5 text-destructive shrink-0" />
            )}
            {src.status === "pending" && (
              <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />
            )}
            {/* 源名称 */}
            <span
              className={cn(
                "truncate",
                src.status === "done" && "text-foreground",
                src.status === "running" && "text-[var(--color-warm-accent)] font-medium",
                src.status === "error" && "text-destructive",
                src.status === "pending" && "text-muted-foreground/60",
              )}
            >
              {src.icon} {src.name}
            </span>
          </div>
          {/* 右侧统计 */}
          <span className="text-muted-foreground/60 whitespace-nowrap shrink-0">
            {src.status === "done" && (
              <>{src.count} 条{src.duration != null && <span className="ml-1">{src.duration.toFixed(1)}s</span>}</>
            )}
            {src.status === "running" && "采集中..."}
            {src.status === "error" && (
              <span className="text-destructive truncate max-w-[100px] inline-block align-bottom" title={src.error}>
                {src.error?.slice(0, 20) || "失败"}
              </span>
            )}
            {src.status === "pending" && "等待中"}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── AI 阶段进度 ──

function AiProgress({ progress }: { progress: PipelineProgress }) {
  const { phase, scoring, clustering, summarizing } = progress

  let text = ""
  if (phase === "scoring" && scoring) {
    text = `已评分 ${scoring.done}/${scoring.total} 条` + (scoring.filtered > 0 ? `，筛选出 ${scoring.filtered} 条` : "")
  } else if (phase === "clustering" && clustering) {
    text = clustering.done > 0
      ? `去重完成，剩余 ${clustering.done} 条`
      : "跨源去重中..."
  } else if (phase === "summarizing" && summarizing) {
    text = `已生成 ${summarizing.done}/${summarizing.total} 条摘要`
  }

  if (!text) return null

  return (
    <p className="animate-gentle-pulse text-xs text-muted-foreground text-center">
      {text}
    </p>
  )
}

// ── 主组件 ──

export function DigestTrigger({ date, onComplete, hasExistingDigest }: DigestTriggerProps) {
  const [status, setStatus] = useState<RunStatus>("none")
  const [progress, setProgress] = useState<PipelineProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // 清理 SSE 连接
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const startSSE = useCallback(() => {
    stopSSE()
    const es = new EventSource(`/api/digest/stream?date=${date}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'status' && data.status === 'none') return

        if (data.progress) {
          const progress = data.progress as PipelineProgress
          setProgress(progress)

          if (progress.phase === 'completed') {
            setStatus('completed')
            stopSSE()
            onComplete()
          } else if (progress.phase === 'failed') {
            setStatus('failed')
            stopSSE()
            setError(progress.detail || '生成失败')
          } else {
            setStatus(progress.phase === 'collecting' ? 'collecting' : 'processing')
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    es.onerror = () => {
      // SSE 自动重连，但如果已完成则关闭
    }
  }, [date, onComplete, stopSSE])

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
      startSSE()
    } catch {
      setStatus("failed")
      setError("请求失败，请检查网络")
    }
  }

  const isRunning = status === "collecting" || status === "processing"

  return (
    <div className="flex flex-col items-center gap-4 py-4">
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

      {/* 步骤条 + 详细进度 */}
      {isRunning && progress && (
        <div className="w-full flex flex-col items-center gap-3">
          <StepBar currentPhase={progress.phase} />

          {/* 采集阶段：源列表 */}
          {progress.phase === "collecting" && progress.sources && (
            <SourceList sources={progress.sources} />
          )}

          {/* AI 阶段：进度文字 */}
          {(progress.phase === "scoring" || progress.phase === "clustering" || progress.phase === "summarizing") && (
            <AiProgress progress={progress} />
          )}
        </div>
      )}

      {/* 还没拿到 progress 时的 fallback */}
      {isRunning && !progress && (
        <p className="animate-gentle-pulse text-xs text-muted-foreground">
          正在初始化...
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

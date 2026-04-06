"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Check, Circle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface DigestTriggerProps {
  date: string
  onComplete: () => void
  hasExistingDigest?: boolean
}

type RunStatus = "none" | "selecting" | "collecting" | "processing" | "completed" | "failed"

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
  scoring?: { total: number; done: number; filtered: number; failed?: number; duration?: number }
  clustering?: { total: number; done: number; duration?: number }
  summarizing?: { total: number; done: number; failed?: number; duration?: number }
  timing?: {
    collecting?: number
    scoring?: number
    clustering?: number
    summarizing?: number
    trends?: number
    total?: number
  }
  detail?: string
}

// ── 源配置类型 ──

interface SourceItem {
  id: string
  name: string
  icon: string
  type: string
  enabled: boolean
}

// ── 步骤条定义 ──

const PHASES = [
  { key: "collecting", label: "采集" },
  { key: "scoring", label: "评分" },
  { key: "clustering", label: "去重" },
  { key: "summarizing", label: "摘要" },
  { key: "completed", label: "完成" },
] as const

function getPhaseIndex(phase?: string): number {
  return PHASES.findIndex(p => p.key === phase)
}

// ── 步骤条组件 ──

function StepBar({ currentPhase, timing }: { currentPhase?: string; timing?: PipelineProgress["timing"] }) {
  const currentIndex = getPhaseIndex(currentPhase)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto">
      {PHASES.map((phase, i) => {
        const isDone = currentIndex > i || currentPhase === "completed"
        const isCurrent = currentIndex === i && currentPhase !== "completed" && currentPhase !== "failed"

        return (
          <div key={phase.key} className="flex items-center">
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
              {isDone && timing?.[phase.key as keyof typeof timing] != null && (
                <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                  {timing[phase.key as keyof typeof timing]}s
                </span>
              )}
            </div>
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

// ── 源状态列表（运行时进度） ──

function SourceList({ sources }: { sources: Record<string, SourceProgress> }) {
  const entries = Object.entries(sources)
  if (entries.length === 0) return null

  return (
    <div className="w-full max-w-xs mx-auto space-y-1">
      {entries.map(([id, src]) => (
        <div key={id} className="flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
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
          <span className="text-muted-foreground/60 whitespace-nowrap shrink-0">
            {src.status === "done" && src.error === '本次跳过' && (
              <span className="text-muted-foreground/40">跳过</span>
            )}
            {src.status === "done" && src.error !== '本次跳过' && (
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

// ── 源选择面板 ──

function SourceSelector({
  sources,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: {
  sources: SourceItem[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}) {
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">选择要采集的源</span>
        <div className="flex items-center gap-2">
          <button onClick={onSelectAll} className="text-[10px] text-[var(--color-warm-accent)] hover:underline">全选</button>
          <button onClick={onDeselectAll} className="text-[10px] text-muted-foreground hover:underline">全不选</button>
        </div>
      </div>
      <div className="space-y-0.5 rounded-lg border border-border/60 bg-card p-2 max-h-[280px] overflow-y-auto">
        {sources.map(src => (
          <label
            key={src.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(src.id)}
              onChange={() => onToggle(src.id)}
              className="size-3.5 rounded border-border accent-[var(--color-warm-accent)]"
            />
            <span className="text-xs text-foreground">{src.icon} {src.name}</span>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">
              {src.type === 'twitter-private' || src.type === 'xiaohongshu-private' ? '私域' : ''}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── 主组件 ──

export function DigestTrigger({ date, onComplete, hasExistingDigest }: DigestTriggerProps) {
  const [status, setStatus] = useState<RunStatus>("none")
  const [progress, setProgress] = useState<PipelineProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  // 计时器
  const [elapsed, setElapsed] = useState(0)
  const [finalElapsed, setFinalElapsed] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // 源选择
  const [availableSources, setAvailableSources] = useState<SourceItem[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())

  // 加载可用源列表
  useEffect(() => {
    fetch('/api/sources')
      .then(r => r.json())
      .then(d => {
        const enabled = (d.sources || []).filter((s: SourceItem) => s.enabled)
        setAvailableSources(enabled)
        setSelectedSourceIds(new Set(enabled.map((s: SourceItem) => s.id)))
      })
      .catch(() => {})
  }, [])

  // mount 时检查是否有正在运行的 pipeline
  useEffect(() => {
    let cancelled = false
    fetch(`/api/digest/status?date=${date}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.status === 'collecting' || data.status === 'processing') {
          setStatus(data.status)
          if (data.progress) setProgress(data.progress)
          if (data.startedAt) {
            startTimeRef.current = new Date(data.startedAt).getTime()
          } else {
            startTimeRef.current = Date.now()
          }
          startSSE()
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      eventSourceRef.current?.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

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
            stopTimer()
            setFinalElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
            onComplete()
          } else if (progress.phase === 'failed') {
            setStatus('failed')
            stopSSE()
            stopTimer()
            setFinalElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
            setError(progress.detail || '生成失败')
          } else {
            setStatus(progress.phase === 'collecting' ? 'collecting' : 'processing')
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    es.onerror = () => {}
  }, [date, onComplete, stopSSE])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    startTimeRef.current = Date.now()
    setElapsed(0)
    setFinalElapsed(null)
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [stopTimer])

  // 点击"生成日报"→ 展开源选择面板
  const handleClickGenerate = () => {
    setStatus("selecting")
    setError(null)
  }

  // 点击"开始采集"→ 带 sourceIds 触发 pipeline
  const handleStartCollecting = async () => {
    const ids = Array.from(selectedSourceIds)
    if (ids.length === 0) return

    setStatus("collecting")
    setProgress(null)
    setError(null)
    startTimer()

    try {
      await fetch("/api/digest/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sourceIds: ids }),
      })
      startSSE()
    } catch {
      setStatus("failed")
      setError("请求失败，请检查网络")
    }
  }

  const toggleSource = (id: string) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isRunning = status === "collecting" || status === "processing"

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* 主按钮 */}
      {status !== "selecting" && (
        <button
          onClick={handleClickGenerate}
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
              <span className="text-xs opacity-60 tabular-nums">{formatTime(elapsed)}</span>
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              <span>{hasExistingDigest ? "重新生成日报" : "生成今日日报"}</span>
            </>
          )}
        </button>
      )}

      {/* 源选择面板 */}
      {status === "selecting" && (
        <div className="w-full flex flex-col items-center gap-3">
          <SourceSelector
            sources={availableSources}
            selected={selectedSourceIds}
            onToggle={toggleSource}
            onSelectAll={() => setSelectedSourceIds(new Set(availableSources.map(s => s.id)))}
            onDeselectAll={() => setSelectedSourceIds(new Set())}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatus("none")}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleStartCollecting}
              disabled={selectedSourceIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-[var(--color-warm-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className="size-3.5" />
              开始采集（{selectedSourceIds.size}/{availableSources.length} 个源）
            </button>
          </div>
        </div>
      )}

      {/* 步骤条 + 详细进度 */}
      {isRunning && progress && (
        <div className="w-full flex flex-col items-center gap-3">
          <StepBar currentPhase={progress.phase} timing={progress.timing} />

          {progress.phase === "collecting" && progress.sources && (
            <SourceList sources={progress.sources} />
          )}

          {(progress.phase === "scoring" || progress.phase === "clustering" || progress.phase === "summarizing") && (
            <AiProgress progress={progress} />
          )}
        </div>
      )}

      {isRunning && !progress && (
        <p className="animate-gentle-pulse text-xs text-muted-foreground">
          正在初始化...
        </p>
      )}

      {/* 完成提示 */}
      {status === "completed" && (
        <div className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="size-4" />
          <span>{progress?.detail || "生成完成"}</span>
          {(progress?.timing?.total != null || finalElapsed != null) && (
            <span className="text-xs text-muted-foreground">
              （耗时 {formatTime(progress?.timing?.total ?? finalElapsed ?? 0)}）
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

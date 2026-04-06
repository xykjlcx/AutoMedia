"use client"

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PolishToolbarProps {
  /** 工具栏锚定位置（相对于编辑器容器） */
  position: { top: number; left: number }
  /** 当前选中的文本 */
  selectedText: string
  /** 选中文本前后的上下文 */
  context: string
  /** 当前平台 */
  platform: string
  /** 润色完成回调，传回替换文本 */
  onPolished: (result: string) => void
  /** 关闭工具栏 */
  onClose: () => void
}

const TONES = [
  { key: 'casual', label: '口语化' },
  { key: 'formal', label: '正式' },
  { key: 'concise', label: '精简' },
  { key: 'expand', label: '扩展' },
] as const

export function PolishToolbar({ position, selectedText, context, platform, onPolished, onClose }: PolishToolbarProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handlePolish = async (tone: string) => {
    setLoading(tone)
    try {
      const res = await fetch('/api/studio/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, tone, platform, context }),
      })
      const data = await res.json()
      if (data.result) {
        onPolished(data.result)
      }
    } catch {
      // 静默失败，工具栏消失即可
    } finally {
      setLoading(null)
      onClose()
    }
  }

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-border/60 bg-card shadow-lg animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {TONES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handlePolish(key)}
          disabled={loading !== null}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
            loading === key
              ? 'bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            loading !== null && loading !== key && 'opacity-40'
          )}
        >
          {loading === key ? <Loader2 className="size-3 animate-spin inline" /> : label}
        </button>
      ))}
    </div>
  )
}

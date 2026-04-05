"use client"

import { useRef, useEffect } from 'react'

interface DraftEditorProps {
  title: string
  content: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  platform: string
}

export function DraftEditor({ title, content, onTitleChange, onContentChange, platform }: DraftEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = 'auto'
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px'
    }
  }, [content])

  const charCount = content.length
  const platformLimits: Record<string, { label: string; max: number }> = {
    xhs: { label: '小红书', max: 1000 },
    twitter: { label: 'Twitter', max: 280 },
    article: { label: '公众号', max: 5000 },
  }
  const limit = platformLimits[platform]

  return (
    <div className="h-full flex flex-col">
      {/* 编辑区域 — 类似在纸上写字的感觉 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* 标题输入 */}
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="输入标题..."
            className="w-full text-2xl font-bold font-serif-display bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-6 leading-tight"
          />

          {/* 分隔线 */}
          <div className="w-12 h-0.5 bg-[var(--color-warm-accent)]/30 mb-6" />

          {/* 正文输入 */}
          <textarea
            ref={bodyRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="从这里开始写正文..."
            className="w-full min-h-[50vh] bg-transparent border-none outline-none resize-none text-base leading-[1.8] placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-border/60 px-6 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          正文字数 {charCount}
          {limit && <span className="ml-1">/ {limit.max}</span>}
        </span>
        <span className="text-muted-foreground/50">Markdown 格式</span>
      </div>
    </div>
  )
}

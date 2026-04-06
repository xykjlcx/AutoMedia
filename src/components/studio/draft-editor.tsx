"use client"

import { useRef, useEffect, useState, useCallback } from 'react'
import { PolishToolbar } from './polish-toolbar'

interface DraftEditorProps {
  title: string
  content: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  platform: string
}

interface Selection {
  text: string
  start: number
  end: number
  position: { top: number; left: number }
  context: string
}

export function DraftEditor({ title, content, onTitleChange, onContentChange, platform }: DraftEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = 'auto'
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px'
    }
  }, [content])

  // 检测文本选中
  const handleSelectionChange = useCallback(() => {
    const textarea = bodyRef.current
    const container = containerRef.current
    if (!textarea || !container) return

    const { selectionStart, selectionEnd } = textarea
    if (selectionStart === selectionEnd || selectionStart === undefined) {
      setSelection(null)
      return
    }

    const selectedText = content.slice(selectionStart, selectionEnd)
    // 太短的选中不触发（避免误操作）
    if (selectedText.trim().length < 4) {
      setSelection(null)
      return
    }

    // 计算工具栏位置
    const textareaRect = textarea.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // 用临时 mirror div 测量选中起始位置的坐标
    const mirror = document.createElement('div')
    const style = window.getComputedStyle(textarea)
    mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:${style.width};font:${style.font};padding:${style.padding};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing};`
    mirror.textContent = content.slice(0, selectionStart)
    const marker = document.createElement('span')
    marker.textContent = '|'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)
    const markerRect = marker.getBoundingClientRect()
    const mirrorRect = mirror.getBoundingClientRect()
    document.body.removeChild(mirror)

    const top = textareaRect.top - containerRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop - 40
    const left = Math.min(
      Math.max(markerRect.left - mirrorRect.left, 0),
      containerRect.width - 280
    )

    // 上下文：选中文本前后各 200 字
    const ctxStart = Math.max(0, selectionStart - 200)
    const ctxEnd = Math.min(content.length, selectionEnd + 200)
    const context = content.slice(ctxStart, selectionStart) + '[SELECTED]' + content.slice(selectionEnd, ctxEnd)

    setSelection({ text: selectedText, start: selectionStart, end: selectionEnd, position: { top, left }, context })
  }, [content])

  // 润色完成：替换选中文本
  const handlePolished = (result: string) => {
    if (!selection) return
    const newContent = content.slice(0, selection.start) + result + content.slice(selection.end)
    onContentChange(newContent)
    setSelection(null)
  }

  const charCount = content.length
  const platformLimits: Record<string, { label: string; max: number }> = {
    xhs: { label: '小红书', max: 1000 },
    twitter: { label: 'Twitter', max: 280 },
    article: { label: '公众号', max: 5000 },
  }
  const limit = platformLimits[platform]

  return (
    <div className="h-full flex flex-col">
      {/* 编辑区域 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
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
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onBlur={() => setTimeout(() => setSelection(null), 200)}
            placeholder="从这里开始写正文..."
            className="w-full min-h-[50vh] bg-transparent border-none outline-none resize-none text-base leading-[1.8] placeholder:text-muted-foreground/30"
          />
        </div>

        {/* 浮动润色工具栏 */}
        {selection && (
          <PolishToolbar
            position={selection.position}
            selectedText={selection.text}
            context={selection.context}
            platform={platform}
            onPolished={handlePolished}
            onClose={() => setSelection(null)}
          />
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="border-t border-border/60 px-6 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          正文字数 {charCount}
          {limit && <span className="ml-1">/ {limit.max}</span>}
        </span>
        <span className="text-muted-foreground/50">Markdown 格式 · 选中文本可润色</span>
      </div>
    </div>
  )
}

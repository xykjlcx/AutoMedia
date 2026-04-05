"use client"

import { useState } from 'react'
import { X, Loader2, Copy, Download, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageGenerateDialogProps {
  defaultPrompt?: string
  onClose: () => void
}

type Ratio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

export function ImageGenerateDialog({ defaultPrompt = '', onClose }: ImageGenerateDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [ratio, setRatio] = useState<Ratio>('16:9')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ imagePath: string; filename: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: ratio }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || '生成失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    const markdownSnippet = `![封面图](${result.imagePath})`
    navigator.clipboard.writeText(markdownSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="font-serif-display text-lg font-semibold flex items-center gap-2">
            <ImageIcon className="size-4 text-[var(--color-warm-accent)]" />
            生成配图
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">描述</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="描述你想要的封面图..."
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:border-[var(--color-warm-accent)] resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">比例</label>
            <div className="flex gap-1.5">
              {(['1:1', '16:9', '9:16', '4:3', '3:4'] as Ratio[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    ratio === r
                      ? 'bg-[var(--color-warm-accent)] text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-warm-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
            {generating ? '生成中...' : '生成'}
          </button>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 p-2 rounded-md bg-red-500/10">{error}</div>
          )}

          {result && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.imagePath} alt="生成结果" className="w-full rounded-lg border border-border/60" />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="size-3" />
                  {copied ? '已复制 Markdown' : '复制 Markdown 链接'}
                </button>
                <a
                  href={result.imagePath}
                  download={result.filename}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-3" />
                  下载
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

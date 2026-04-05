"use client"

import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'

interface CardPreviewProps {
  draftId: string
  onClose: () => void
}

export function CardPreview({ draftId, onClose }: CardPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [imageData, setImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImageData(data.image)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!imageData) return
    const link = document.createElement('a')
    link.href = imageData
    link.download = `share-card-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">分享卡片</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="size-4" /></button>
        </div>

        {!imageData && !loading && (
          <div className="text-center py-8">
            <button onClick={generate} className="px-4 py-2 rounded-lg bg-[var(--color-warm-accent)] text-white font-medium hover:opacity-90 transition-opacity">
              生成分享卡片
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">AI 生成文案 + 渲染中...</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500 text-center py-4">{error}</p>}

        {imageData && (
          <div>
            <img src={imageData} alt="Share Card" className="w-full rounded-lg mb-4" />
            <button onClick={download} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-medium">
              <Download className="size-4" />
              下载图片
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

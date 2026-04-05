"use client"

import { useState, useEffect } from 'react'
import { X, Download, Loader2 } from 'lucide-react'

interface CardPreviewProps {
  draftId: string
  onClose: () => void
}

// 前端硬编码模板清单（与后端 CARD_TEMPLATES 保持一致），避免额外 round trip
const TEMPLATES = [
  { id: 'dark-gradient', name: '深色渐变' },
  { id: 'minimal', name: '简约白' },
  { id: 'academic', name: '学术风' },
  { id: 'xhs', name: '小红书风' },
  { id: 'warm', name: '暖色手账' },
] as const

type TemplateId = (typeof TEMPLATES)[number]['id']

export function CardPreview({ draftId, onClose }: CardPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [imageData, setImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('dark-gradient')

  const generate = async (template: TemplateId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/studio/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, template }),
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

  // 打开弹窗时自动用默认模板生成一次
  useEffect(() => {
    generate(selectedTemplate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectTemplate = (template: TemplateId) => {
    if (template === selectedTemplate || loading) return
    setSelectedTemplate(template)
    generate(template)
  }

  const download = () => {
    if (!imageData) return
    const link = document.createElement('a')
    link.href = imageData
    link.download = `share-card-${selectedTemplate}-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">分享卡片</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {/* 模板选择器 */}
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">选择模板</div>
          <div className="flex gap-2 flex-wrap">
            {TEMPLATES.map((t) => {
              const isActive = t.id === selectedTemplate
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-[var(--color-warm-accent)] text-white shadow-sm'
                      : 'bg-muted text-foreground hover:bg-muted/70'
                  }`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* 图像展示区 */}
        <div className="min-h-[240px] flex items-center justify-center bg-muted/30 rounded-lg mb-4 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm z-10">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">AI 生成文案 + 渲染中...</p>
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500 text-center py-4 px-4">{error}</p>
          )}

          {imageData && !error && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageData} alt="Share Card" className="w-full rounded-lg" />
          )}

          {!imageData && !loading && !error && (
            <p className="text-sm text-muted-foreground">尚未生成</p>
          )}
        </div>

        {/* 下载按钮 */}
        <button
          onClick={download}
          disabled={!imageData || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="size-4" />
          下载图片
        </button>
      </div>
    </div>
  )
}

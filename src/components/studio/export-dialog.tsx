"use client"

import { X, FileText, Code } from 'lucide-react'
import { trackEvent } from '@/components/hooks/use-track-event'

interface ExportDialogProps {
  draftId: string
  onClose: () => void
}

export function ExportDialog({ draftId, onClose }: ExportDialogProps) {
  const handleExport = async (format: 'html' | 'markdown') => {
    trackEvent('export_content', 'draft', draftId, { format })
    const res = await fetch('/api/studio/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, format }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = format === 'html' ? 'export.html' : 'export.md'
    link.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">导出</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => handleExport('html')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <Code className="size-5 text-[var(--color-warm-accent)]" />
            <div>
              <p className="text-sm font-medium">HTML</p>
              <p className="text-xs text-muted-foreground">带样式的网页文件</p>
            </div>
          </button>
          <button
            onClick={() => handleExport('markdown')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <FileText className="size-5 text-[var(--color-warm-accent)]" />
            <div>
              <p className="text-sm font-medium">Markdown</p>
              <p className="text-xs text-muted-foreground">纯文本格式，兼容各平台</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

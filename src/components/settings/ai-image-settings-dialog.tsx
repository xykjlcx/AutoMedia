"use client"

import { useEffect, useState } from 'react'
import { X, Image as ImageIcon, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Provider = '' | 'google' | 'openai'

interface ImageSettings {
  provider: Provider
  baseUrl: string
  apiKey: string
  model: string
}

interface AiImageSettingsDialogProps {
  open: boolean
  onClose: () => void
}

// 独立 Dialog：避免侵入现有 settings page 结构
export function AiImageSettingsDialog({ open, onClose }: AiImageSettingsDialogProps) {
  const [data, setData] = useState<ImageSettings>({ provider: '', baseUrl: '', apiKey: '', model: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 打开时拉取现有配置
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setSaved(false)
    fetch('/api/settings/ai-image')
      .then(r => r.json())
      .then((d: ImageSettings) => setData({
        provider: (d.provider as Provider) || '',
        baseUrl: d.baseUrl || '',
        apiKey: d.apiKey || '',
        model: d.model || '',
      }))
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/ai-image', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || '保存失败')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // Provider 默认模型提示
  const modelPlaceholder = data.provider === 'google'
    ? 'gemini-2.5-flash-image-preview'
    : data.provider === 'openai'
      ? 'gpt-image-1'
      : '选择 provider 后填入'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-xl border border-border/60 bg-background shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border/60 bg-background/95 backdrop-blur-sm rounded-t-xl">
          <h3 className="font-serif-display text-lg font-semibold text-foreground flex items-center gap-2">
            <ImageIcon className="size-5 text-[var(--color-warm-accent)]" />
            图片生成配置
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <>
              {/* Provider 选择 */}
              <section>
                <h4 className="text-sm font-medium text-foreground mb-2">Provider</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['', 'google', 'openai'] as Provider[]).map(p => (
                    <button
                      key={p || 'none'}
                      onClick={() => setData(prev => ({ ...prev, provider: p }))}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                        data.provider === p
                          ? 'border-[var(--color-warm-accent)] bg-[var(--color-warm-accent)]/5 text-[var(--color-warm-accent)]'
                          : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/50'
                      )}
                    >
                      {p === '' ? '未配置' : p === 'google' ? 'Google Gemini' : 'OpenAI 兼容'}
                    </button>
                  ))}
                </div>
              </section>

              {/* Base URL（仅 openai 时显示） */}
              {data.provider === 'openai' && (
                <section>
                  <h4 className="text-sm font-medium text-foreground mb-2">Base URL</h4>
                  <input
                    type="url"
                    value={data.baseUrl}
                    onChange={e => setData(prev => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com"
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    OpenAI 兼容服务的根地址，会自动拼接 /v1/images/generations
                  </p>
                </section>
              )}

              {/* API Key */}
              <section>
                <h4 className="text-sm font-medium text-foreground mb-2">API Key</h4>
                <input
                  type="password"
                  value={data.apiKey}
                  onChange={e => setData(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={data.apiKey.includes('***') ? data.apiKey : 'sk-...'}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                />
                {data.apiKey.includes('***') && (
                  <p className="text-xs text-muted-foreground mt-1.5">已保存，留空或保持脱敏显示则不修改</p>
                )}
              </section>

              {/* Model */}
              <section>
                <h4 className="text-sm font-medium text-foreground mb-2">Model</h4>
                <input
                  type="text"
                  value={data.model}
                  onChange={e => setData(prev => ({ ...prev, model: e.target.value }))}
                  placeholder={modelPlaceholder}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                />
              </section>

              {/* 保存 */}
              <div className="flex items-center gap-3 flex-wrap pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                    'bg-[var(--color-warm-accent)] text-white hover:bg-[var(--color-warm-accent-hover)] active:scale-[0.98]',
                    saving && 'opacity-60 cursor-wait'
                  )}
                >
                  {saving ? '保存中...' : '保存配置'}
                </button>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-sm text-green-600">
                    <Check className="size-4" />
                    已保存
                  </span>
                )}
                {error && (
                  <span className="text-sm text-destructive">{error}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

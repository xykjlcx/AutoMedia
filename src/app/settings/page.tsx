"use client"

import { useState, useEffect } from "react"
import { Settings, Check, AlertCircle, Key, Server, Cpu, Zap, Sparkles, Rss, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface SettingsData {
  provider: string
  baseUrl: string
  apiKey: string
  fastModel: string
  qualityModel: string
  hasEnvKey: boolean
}

interface SourceConfig {
  id: string
  name: string
  icon: string
  type: string
  rssPath: string
  rssUrl: string
  targetUrl: string
  enabled: boolean
  maxItems: number
  sortOrder: number
  createdAt: string
}

const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 系列模型",
    placeholder: "sk-ant-...",
    defaultFast: "claude-haiku-4-5-20251001",
    defaultQuality: "claude-sonnet-4-6",
    presets: [
      { label: "Haiku 4.5", value: "claude-haiku-4-5-20251001" },
      { label: "Sonnet 4.6", value: "claude-sonnet-4-6" },
      { label: "Opus 4.6", value: "claude-opus-4-6" },
    ],
  },
  {
    id: "openai-compatible",
    name: "OpenAI 兼容",
    description: "OpenAI / DeepSeek / 中转站等",
    placeholder: "sk-...",
    defaultFast: "gpt-4o-mini",
    defaultQuality: "gpt-4o",
    presets: [
      { label: "GPT-4o Mini", value: "gpt-4o-mini" },
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "DeepSeek V3", value: "deepseek-chat" },
      { label: "DeepSeek R1", value: "deepseek-reasoner" },
    ],
    showBaseUrl: true,
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini 系列模型",
    placeholder: "AIza...",
    defaultFast: "gemini-2.0-flash",
    defaultQuality: "gemini-2.5-pro-preview-05-06",
    presets: [
      { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
      { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro-preview-05-06" },
    ],
  },
]

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  public: { label: "公域", className: "bg-blue-50 text-blue-600 border border-blue-100" },
  private: { label: "私域", className: "bg-amber-50 text-amber-600 border border-amber-100" },
  "custom-rss": { label: "自定义", className: "bg-purple-50 text-purple-600 border border-purple-100" },
}

// 信息源管理 Section
function SourcesSection() {
  const [sources, setSources] = useState<SourceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSource, setNewSource] = useState({ name: "", rssUrl: "", icon: "📰" })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const fetchSources = () => {
    fetch("/api/sources")
      .then(r => r.json())
      .then(data => {
        setSources(data.sources || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchSources() }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    // 乐观更新
    setSources(prev => prev.map(s => s.id === id ? { ...s, enabled } : s))
    await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
  }

  const handleMaxItemsChange = async (id: string, maxItems: number) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, maxItems } : s))
    await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxItems }),
    })
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`确定要删除「${name}」吗？`)) return
    setSources(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/sources/${id}`, { method: "DELETE" })
  }

  const handleAdd = async () => {
    if (!newSource.name.trim() || !newSource.rssUrl.trim()) {
      setAddError("名称和 RSS URL 不能为空")
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      })
      if (!res.ok) throw new Error("添加失败")
      setNewSource({ name: "", rssUrl: "", icon: "📰" })
      setShowAddForm(false)
      fetchSources()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "添加失败")
    } finally {
      setAdding(false)
    }
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-4">
        <Rss className="size-4" />
        信息源管理
      </h2>

      {loading ? (
        <div className="text-sm text-muted-foreground py-4">加载中...</div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          {sources.map((source, idx) => (
            <div
              key={source.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                idx !== sources.length - 1 && "border-b border-border/40"
              )}
            >
              {/* 图标 + 名称 */}
              <span className="text-lg leading-none shrink-0">{source.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{source.name}</span>
                  {TYPE_LABELS[source.type] && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium leading-none",
                      TYPE_LABELS[source.type].className
                    )}>
                      {TYPE_LABELS[source.type].label}
                    </span>
                  )}
                </div>
              </div>

              {/* 每源数量 */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">条数</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={source.maxItems}
                  onChange={e => handleMaxItemsChange(source.id, Number(e.target.value))}
                  className="w-12 px-1.5 py-1 rounded border border-border/60 bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)]"
                />
              </div>

              {/* 开关 */}
              <button
                onClick={() => handleToggle(source.id, !source.enabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  source.enabled
                    ? "bg-[var(--color-warm-accent)]"
                    : "bg-muted-foreground/30"
                )}
                aria-label={source.enabled ? "禁用" : "启用"}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                    source.enabled ? "translate-x-[18px]" : "translate-x-[2px]"
                  )}
                />
              </button>

              {/* 删除（仅自定义源） */}
              {source.type === "custom-rss" && (
                <button
                  onClick={() => handleDelete(source.id, source.name)}
                  className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  aria-label="删除"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}

          {sources.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              暂无信息源
            </div>
          )}
        </div>
      )}

      {/* 添加自定义 RSS */}
      <div className="mt-3">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="size-4" />
            添加自定义 RSS
          </button>
        ) : (
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">添加自定义 RSS</span>
              <button
                onClick={() => { setShowAddForm(false); setAddError(null) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
              <label className="text-xs text-muted-foreground w-16">名称</label>
              <input
                type="text"
                value={newSource.name}
                onChange={e => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例：少数派"
                className="px-3 py-1.5 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
              />
              <label className="text-xs text-muted-foreground w-16">RSS URL</label>
              <input
                type="url"
                value={newSource.rssUrl}
                onChange={e => setNewSource(prev => ({ ...prev, rssUrl: e.target.value }))}
                placeholder="https://sspai.com/feed"
                className="px-3 py-1.5 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
              />
              <label className="text-xs text-muted-foreground w-16">图标</label>
              <input
                type="text"
                value={newSource.icon}
                onChange={e => setNewSource(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="📰"
                className="w-20 px-3 py-1.5 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
              />
            </div>

            {addError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3" />
                {addError}
              </p>
            )}

            <button
              onClick={handleAdd}
              disabled={adding}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                "bg-[var(--color-warm-accent)] text-white hover:bg-[var(--color-warm-accent-hover)] active:scale-[0.98]",
                adding && "opacity-60 cursor-wait"
              )}
            >
              {adding ? "添加中..." : "保存"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    provider: "anthropic",
    baseUrl: "",
    apiKey: "",
    fastModel: "claude-haiku-4-5-20251001",
    qualityModel: "claude-sonnet-4-6",
    hasEnvKey: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((data: SettingsData) => {
        setSettings(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const currentProvider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0]

  const handleProviderChange = (providerId: string) => {
    const provider = PROVIDERS.find(p => p.id === providerId)
    if (!provider) return
    setSettings(prev => ({
      ...prev,
      provider: providerId,
      fastModel: provider.defaultFast,
      qualityModel: provider.defaultQuality,
      // 切换 provider 时清空 baseUrl 和 key
      baseUrl: "",
      apiKey: "",
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          fastModel: settings.fastModel,
          qualityModel: settings.qualityModel,
        }),
      })
      if (!res.ok) throw new Error("保存失败")
      setSaved(true)
      // 重新获取（拿脱敏后的 key）
      const data = await fetch("/api/settings").then(r => r.json())
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px] px-4 pb-16">
        <div className="py-6 text-center">
          <div className="animate-gentle-pulse text-sm text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      {/* 页面标题 */}
      <div className="py-6 text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          模型设置
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          配置 AI 模型的接入方式和参数
        </p>
      </div>

      <Separator className="mb-8" />

      <div className="space-y-8">
        {/* 信息源管理 */}
        <SourcesSection />

        <Separator />

        {/* Provider 选择 */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-4">
            <Server className="size-4" />
            服务商
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROVIDERS.map(provider => (
              <button
                key={provider.id}
                onClick={() => handleProviderChange(provider.id)}
                className={cn(
                  "flex flex-col items-start gap-1 p-4 rounded-lg border transition-all text-left",
                  settings.provider === provider.id
                    ? "border-[var(--color-warm-accent)] bg-[var(--color-warm-accent)]/5 shadow-sm"
                    : "border-border/60 hover:border-border hover:bg-muted/50"
                )}
              >
                <span className="font-medium text-sm text-foreground">{provider.name}</span>
                <span className="text-xs text-muted-foreground">{provider.description}</span>
              </button>
            ))}
          </div>
        </section>

        {/* API Key */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-3">
            <Key className="size-4" />
            API Key
          </h2>
          {settings.hasEnvKey && (
            <p className="text-xs text-muted-foreground mb-2">
              已检测到环境变量中的 API Key，下方留空将使用环境变量
            </p>
          )}
          <input
            type="password"
            value={settings.apiKey}
            onChange={e => { setSettings(prev => ({ ...prev, apiKey: e.target.value })); setSaved(false) }}
            placeholder={currentProvider.placeholder}
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
          />
        </section>

        {/* Base URL（仅 OpenAI 兼容模式显示） */}
        {currentProvider.showBaseUrl && (
          <section>
            <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-3">
              <Server className="size-4" />
              Base URL
            </h2>
            <input
              type="url"
              value={settings.baseUrl}
              onChange={e => { setSettings(prev => ({ ...prev, baseUrl: e.target.value })); setSaved(false) }}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              中转站或自建服务的接口地址，留空则使用 OpenAI 官方地址
            </p>
          </section>
        )}

        {/* 模型选择 */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-4">
            <Cpu className="size-4" />
            模型配置
          </h2>

          <div className="space-y-4">
            {/* 快速模型 */}
            <div className="p-4 rounded-lg border border-border/60 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="size-4 text-amber-500" />
                <span className="text-sm font-medium text-foreground">快速模型</span>
                <span className="text-xs text-muted-foreground">— 评分筛选、去重聚类</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.fastModel}
                  onChange={e => { setSettings(prev => ({ ...prev, fastModel: e.target.value })); setSaved(false) }}
                  placeholder="模型名称"
                  className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                />
              </div>
              {currentProvider.presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {currentProvider.presets.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => { setSettings(prev => ({ ...prev, fastModel: preset.value })); setSaved(false) }}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs transition-colors",
                        settings.fastModel === preset.value
                          ? "bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] font-medium"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 质量模型 */}
            <div className="p-4 rounded-lg border border-border/60 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-purple-500" />
                <span className="text-sm font-medium text-foreground">质量模型</span>
                <span className="text-xs text-muted-foreground">— 摘要生成</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.qualityModel}
                  onChange={e => { setSettings(prev => ({ ...prev, qualityModel: e.target.value })); setSaved(false) }}
                  placeholder="模型名称"
                  className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                />
              </div>
              {currentProvider.presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {currentProvider.presets.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => { setSettings(prev => ({ ...prev, qualityModel: preset.value })); setSaved(false) }}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs transition-colors",
                        settings.qualityModel === preset.value
                          ? "bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] font-medium"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 保存按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
              "bg-[var(--color-warm-accent)] text-white hover:bg-[var(--color-warm-accent-hover)] active:scale-[0.98]",
              saving && "opacity-60 cursor-wait"
            )}
          >
            {saving ? "保存中..." : "保存设置"}
          </button>

          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check className="size-4" />
              已保存
            </span>
          )}

          {error && (
            <span className="inline-flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

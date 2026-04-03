"use client"

import { useState, useEffect } from "react"
import { Settings, Check, AlertCircle, Key, Server, Cpu, Zap, Sparkles } from "lucide-react"
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

"use client"

import { useState, useEffect } from "react"
import { Settings, Check, AlertCircle, Key, Server, Cpu, Zap, Sparkles, Rss, Plus, Trash2, ChevronDown, ChevronUp, Clock, Bell, Send } from "lucide-react"
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

interface ScheduleData {
  enabled: boolean
  cronExpression: string
  telegramEnabled: boolean
  telegramBotToken: string
  telegramChatId: string
}

const CRON_PRESETS = [
  { label: "每天 6:00", value: "0 6 * * *" },
  { label: "每天 7:00", value: "0 7 * * *" },
  { label: "每天 8:00", value: "0 8 * * *" },
  { label: "每 12 小时", value: "0 */12 * * *" },
]

const API_PROTOCOLS = [
  { id: "openai", name: "OpenAI Chat Completions", description: "兼容 OpenAI / DeepSeek / Gemini / 中转站等" },
  { id: "anthropic", name: "Anthropic Messages", description: "Claude 原生协议" },
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

  const [schedule, setSchedule] = useState<ScheduleData>({
    enabled: false,
    cronExpression: "0 6 * * *",
    telegramEnabled: false,
    telegramBotToken: "",
    telegramChatId: "",
  })
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((data: SettingsData) => {
        setSettings(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch("/api/settings/schedule")
      .then(r => r.json())
      .then((data: ScheduleData) => {
        setSchedule(data)
        setScheduleLoading(false)
      })
      .catch(() => setScheduleLoading(false))
  }, [])

  const handleProtocolChange = (protocol: string) => {
    setSettings(prev => ({ ...prev, provider: protocol }))
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

  const handleScheduleSave = async () => {
    setScheduleSaving(true)
    setScheduleError(null)
    setScheduleSaved(false)

    try {
      const res = await fetch("/api/settings/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      })
      if (!res.ok) throw new Error("保存失败")
      setScheduleSaved(true)
      // 重新获取（拿脱敏后的 token）
      const data = await fetch("/api/settings/schedule").then(r => r.json())
      setSchedule(data)
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setScheduleSaving(false)
    }
  }

  const handleTestTelegram = async () => {
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/settings/schedule/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramBotToken: schedule.telegramBotToken,
          telegramChatId: schedule.telegramChatId,
        }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      setTestResult({ ok: data.success, msg: data.success ? "发送成功" : (data.error ?? "发送失败") })
    } catch {
      setTestResult({ ok: false, msg: "发送失败" })
    } finally {
      setTestSending(false)
    }
  }

  if (loading || scheduleLoading) {
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

        {/* 请求地址 */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-3">
            <Server className="size-4" />
            请求地址
          </h2>
          <input
            type="url"
            value={settings.baseUrl}
            onChange={e => { setSettings(prev => ({ ...prev, baseUrl: e.target.value })); setSaved(false) }}
            placeholder={settings.provider === 'anthropic' ? "https://api.anthropic.com" : "https://api.openai.com/v1"}
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            填写 API 服务的完整地址。中转站、自建服务或官方地址均可。留空使用默认地址。
          </p>
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
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
          />
        </section>

        {/* API 协议 */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-3">
            <Server className="size-4" />
            API 协议
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {API_PROTOCOLS.map(protocol => (
              <button
                key={protocol.id}
                onClick={() => handleProtocolChange(protocol.id)}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-lg border transition-all text-left",
                  settings.provider === protocol.id
                    ? "border-[var(--color-warm-accent)] bg-[var(--color-warm-accent)]/5"
                    : "border-border/60 hover:border-border hover:bg-muted/50"
                )}
              >
                <span className="font-medium text-sm text-foreground">{protocol.name}</span>
                <span className="text-xs text-muted-foreground">{protocol.description}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 模型名称 */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-4">
            <Cpu className="size-4" />
            模型名称
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border/60 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="size-4 text-amber-500" />
                <span className="text-sm font-medium text-foreground">快速模型</span>
                <span className="text-xs text-muted-foreground">— 评分筛选、去重聚类</span>
              </div>
              <input
                type="text"
                value={settings.fastModel}
                onChange={e => { setSettings(prev => ({ ...prev, fastModel: e.target.value })); setSaved(false) }}
                placeholder="例：gpt-4o-mini / claude-haiku-4-5-20251001 / deepseek-chat"
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
              />
            </div>

            <div className="p-4 rounded-lg border border-border/60 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-purple-500" />
                <span className="text-sm font-medium text-foreground">质量模型</span>
                <span className="text-xs text-muted-foreground">— 摘要生成</span>
              </div>
              <input
                type="text"
                value={settings.qualityModel}
                onChange={e => { setSettings(prev => ({ ...prev, qualityModel: e.target.value })); setSaved(false) }}
                placeholder="例：gpt-4o / claude-sonnet-4-6 / deepseek-chat"
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
              />
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

        <Separator />

        {/* ─── 定时生成 ─── */}
        <section>
          <h2 className="flex items-center gap-2 font-serif-display text-base font-semibold text-foreground mb-6">
            <Clock className="size-4" />
            定时生成
          </h2>

          <div className="space-y-6">
            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">启用定时生成</p>
                <p className="text-xs text-muted-foreground mt-0.5">按计划自动生成每日日报</p>
              </div>
              <button
                role="switch"
                aria-checked={schedule.enabled}
                onClick={() => { setSchedule(prev => ({ ...prev, enabled: !prev.enabled })); setScheduleSaved(false) }}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30",
                  schedule.enabled ? "bg-[var(--color-warm-accent)]" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    schedule.enabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Cron 表达式 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">执行时间</label>
              <input
                type="text"
                value={schedule.cronExpression}
                onChange={e => { setSchedule(prev => ({ ...prev, cronExpression: e.target.value })); setScheduleSaved(false) }}
                placeholder="0 6 * * *"
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {CRON_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => { setSchedule(prev => ({ ...prev, cronExpression: preset.value })); setScheduleSaved(false) }}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs transition-colors",
                      schedule.cronExpression === preset.value
                        ? "bg-[var(--color-warm-accent)]/10 text-[var(--color-warm-accent)] font-medium"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                标准 cron 格式：分 时 日 月 周（服务器本地时间）
              </p>
            </div>

            {/* Telegram 通知 */}
            <div className="p-4 rounded-lg border border-border/60 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-blue-500" />
                  <span className="text-sm font-medium text-foreground">Telegram 通知</span>
                </div>
                <button
                  role="switch"
                  aria-checked={schedule.telegramEnabled}
                  onClick={() => { setSchedule(prev => ({ ...prev, telegramEnabled: !prev.telegramEnabled })); setScheduleSaved(false) }}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30",
                    schedule.telegramEnabled ? "bg-[var(--color-warm-accent)]" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform",
                      schedule.telegramEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Bot Token</label>
                  <input
                    type="password"
                    value={schedule.telegramBotToken}
                    onChange={e => { setSchedule(prev => ({ ...prev, telegramBotToken: e.target.value })); setScheduleSaved(false) }}
                    placeholder="123456:ABC-DEF..."
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Chat ID</label>
                  <input
                    type="text"
                    value={schedule.telegramChatId}
                    onChange={e => { setSchedule(prev => ({ ...prev, telegramChatId: e.target.value })); setScheduleSaved(false) }}
                    placeholder="-1001234567890"
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)] transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleTestTelegram}
                    disabled={testSending || !schedule.telegramChatId}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      "border-border/60 bg-background hover:bg-muted active:scale-[0.98]",
                      (testSending || !schedule.telegramChatId) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Send className="size-3" />
                    {testSending ? "发送中..." : "发送测试"}
                  </button>

                  {testResult && (
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs",
                      testResult.ok ? "text-green-600" : "text-destructive"
                    )}>
                      {testResult.ok
                        ? <Check className="size-3" />
                        : <AlertCircle className="size-3" />
                      }
                      {testResult.msg}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleScheduleSave}
                disabled={scheduleSaving}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                  "bg-[var(--color-warm-accent)] text-white hover:bg-[var(--color-warm-accent-hover)] active:scale-[0.98]",
                  scheduleSaving && "opacity-60 cursor-wait"
                )}
              >
                {scheduleSaving ? "保存中..." : "保存设置"}
              </button>

              {scheduleSaved && (
                <span className="inline-flex items-center gap-1 text-sm text-green-600">
                  <Check className="size-4" />
                  已保存
                </span>
              )}

              {scheduleError && (
                <span className="inline-flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {scheduleError}
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

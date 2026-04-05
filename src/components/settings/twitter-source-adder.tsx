"use client"

import { useEffect, useState } from 'react'
import { Bird, Plus, Loader2, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TwitterSourceAdderProps {
  onAdded?: () => void
}

// Twitter 快捷添加卡片：支持公开用户 + 我的时间线（私域）
export function TwitterSourceAdder({ onAdded }: TwitterSourceAdderProps) {
  const [username, setUsername] = useState('')
  const [type, setType] = useState<'public' | 'private'>('public')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null)

  // 切到私域时才检测 agent-browser CLI 可用性，避免无意义请求
  useEffect(() => {
    if (type !== 'private') return
    if (cliAvailable !== null) return
    fetch('/api/sources/twitter/health')
      .then(r => r.json())
      .then(d => setCliAvailable(!!d.cliAvailable))
      .catch(() => setCliAvailable(false))
  }, [type, cliAvailable])

  const handleAdd = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/sources/twitter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: type === 'public' ? username : '',
          type,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const msg = data.duplicate
          ? '该 Twitter 源已存在'
          : data.updated
            ? '已更新为私域时间线'
            : '添加成功'
        setResult({ ok: true, message: msg })
        setUsername('')
        onAdded?.()
      } else {
        setResult({ ok: false, message: data.error || '添加失败' })
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : '请求失败' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bird className="size-4 text-[var(--color-warm-accent)]" />
        <h3 className="text-sm font-medium text-foreground">添加 Twitter 源</h3>
      </div>

      <div className="space-y-3">
        {/* 类型切换 */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setType('public')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              type === 'public'
                ? 'bg-[var(--color-warm-accent)] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            公开用户
          </button>
          <button
            onClick={() => setType('private')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              type === 'private'
                ? 'bg-[var(--color-warm-accent)] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            我的时间线（需登录）
          </button>
        </div>

        {type === 'public' ? (
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.replace(/^@/, ''))}
            placeholder="@username（例如 elonmusk）"
            className="w-full px-3 py-2 rounded-md border border-border/60 bg-background text-sm outline-none focus:border-[var(--color-warm-accent)] focus:ring-2 focus:ring-[var(--color-warm-accent)]/20"
          />
        ) : (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>私域时间线通过 Agent Browser 抓取登录后的 feed。前置要求：</p>
            <ul className="list-disc list-inside ml-1 space-y-0.5">
              <li>Chrome 以 remote debugging 模式启动</li>
              <li>已登录 x.com</li>
              <li>全局安装 agent-browser CLI</li>
            </ul>
            {cliAvailable === false && (
              <p className="flex items-center gap-1 text-orange-600 dark:text-orange-400 mt-2">
                <AlertTriangle className="size-3" />
                当前未检测到 agent-browser CLI
              </p>
            )}
            {cliAvailable === true && (
              <p className="flex items-center gap-1 text-green-600 dark:text-green-400 mt-2">
                <Check className="size-3" />
                agent-browser CLI 可用
              </p>
            )}
            <p className="text-muted-foreground/70">详细说明见 docs/twitter-setup.md</p>
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={loading || (type === 'public' && !username.trim())}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--color-warm-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          添加
        </button>

        {result && (
          <div className={cn(
            'text-xs px-2 py-1.5 rounded-md',
            result.ok
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}

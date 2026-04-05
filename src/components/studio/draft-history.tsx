"use client"

import { useState, useEffect } from 'react'
import { X, Plus, MoreHorizontal, Loader2, Pencil, Trash2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Platform } from './platform-selector'

interface DraftSummary {
  id: string
  title: string | null
  platform: Platform
  status: string
  createdAt: string
  updatedAt: string
  sourceCount?: number
}

interface DraftHistoryProps {
  currentDraftId: string | null
  onSelect: (draftId: string) => void
  onNew: () => void
  onDelete: (draftId: string) => void
  refreshKey: number
  onClose: () => void
}

// 平台配置
const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; dotColor: string }> = {
  xhs: { label: '小红书', icon: '📕', dotColor: 'bg-red-500' },
  twitter: { label: 'Twitter', icon: '🐦', dotColor: 'bg-sky-500' },
  article: { label: '公众号', icon: '📖', dotColor: 'bg-emerald-500' },
}

// 相对时间格式化
function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export function DraftHistory({
  currentDraftId,
  onSelect,
  onNew,
  onDelete,
  refreshKey,
  onClose,
}: DraftHistoryProps) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 拉取草稿列表
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/studio/drafts')
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setDrafts(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [refreshKey])

  // 点击空白处关闭 dropdown
  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [openMenuId])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条草稿吗？')) return
    setDeletingId(id)
    try {
      await fetch(`/api/studio/drafts/${id}`, { method: 'DELETE' })
      setDrafts(prev => prev.filter(d => d.id !== id))
      onDelete(id)
    } finally {
      setDeletingId(null)
      setOpenMenuId(null)
    }
  }

  return (
    <div className="w-80 shrink-0 border-r border-border/60 bg-card flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
        <div>
          <span className="text-sm font-medium">草稿历史</span>
          {!loading && (
            <span className="ml-2 text-xs text-muted-foreground">共 {drafts.length} 条</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 新建草稿按钮 */}
      <div className="px-3 py-2.5 border-b border-border/60 shrink-0">
        <button
          onClick={onNew}
          className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-warm-accent)] hover:bg-[var(--color-warm-accent)]/8 transition-colors border border-dashed border-[var(--color-warm-accent)]/30 hover:border-[var(--color-warm-accent)]/60"
        >
          <Plus className="size-4" />
          <span>新建草稿</span>
        </button>
      </div>

      {/* 列表区 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground/60 gap-2">
            <FileText className="size-8 opacity-40" />
            <p className="text-xs leading-relaxed">
              还没有草稿，点击上方 <span className="text-[var(--color-warm-accent)]">新建草稿</span> 开始创作
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {drafts.map(draft => {
              const isActive = draft.id === currentDraftId
              const platform = PLATFORM_CONFIG[draft.platform] ?? PLATFORM_CONFIG.article

              return (
                <li key={draft.id} className="relative">
                  {/* 选中状态左边框 */}
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[var(--color-warm-accent)] rounded-full" />
                  )}
                  <div
                    className={cn(
                      'mx-2 my-0.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group',
                      isActive
                        ? 'bg-[var(--color-warm-accent)]/10'
                        : 'hover:bg-muted/60'
                    )}
                    onClick={() => onSelect(draft.id)}
                  >
                    {/* 平台 badge */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', platform.dotColor)} />
                      <span className="text-xs font-medium text-muted-foreground">{platform.label}</span>
                    </div>

                    {/* 标题行 + 操作按钮 */}
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={cn(
                        'text-sm leading-snug flex-1 min-w-0 truncate',
                        isActive ? 'text-foreground font-medium' : 'text-foreground/80'
                      )}>
                        {draft.title?.trim() || '无标题'}
                      </p>

                      {/* 三点菜单 */}
                      <div className="relative shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === draft.id ? null : draft.id)
                          }}
                          className={cn(
                            'p-0.5 rounded transition-opacity text-muted-foreground hover:text-foreground',
                            openMenuId === draft.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>

                        {openMenuId === draft.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-popover border border-border/60 rounded-lg shadow-lg py-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                onSelect(draft.id)
                                setOpenMenuId(null)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left"
                            >
                              <Pencil className="size-3" />
                              继续编辑
                            </button>
                            <button
                              onClick={() => handleDelete(draft.id)}
                              disabled={deletingId === draft.id}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left text-destructive"
                            >
                              {deletingId === draft.id
                                ? <Loader2 className="size-3 animate-spin" />
                                : <Trash2 className="size-3" />}
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 时间信息 */}
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {formatRelativeTime(draft.updatedAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

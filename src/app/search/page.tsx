"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search } from "lucide-react"
import { DigestCard } from "@/components/digest/digest-card"
import type { DigestItem } from "@/components/digest/digest-card"

// 从 API 返回的原始字段（snake_case 或 camelCase，取决于是否经过 Drizzle）
interface RawDigestItem {
  id: string
  digest_date?: string
  digestDate?: string
  source: string
  title: string
  url: string
  author: string | null
  ai_score?: number
  aiScore?: number
  one_liner?: string
  oneLiner?: string
  summary: string
  cluster_id?: string | null
  clusterId?: string | null
  cluster_sources?: string[] | null
  clusterSources?: string[] | null
  is_read?: boolean
  isRead?: boolean
}

function normalizeItem(raw: RawDigestItem): DigestItem {
  return {
    id: raw.id,
    digestDate: raw.digestDate ?? raw.digest_date ?? '',
    source: raw.source,
    title: raw.title,
    url: raw.url,
    author: raw.author,
    aiScore: raw.aiScore ?? raw.ai_score ?? 0,
    oneLiner: raw.oneLiner ?? raw.one_liner ?? '',
    summary: raw.summary,
    clusterId: raw.clusterId ?? raw.cluster_id ?? null,
    clusterSources: raw.clusterSources ?? raw.cluster_sources ?? null,
    isFavorited: false,
    isRead: raw.isRead ?? raw.is_read ?? false,
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DigestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setResults((json.results ?? []).map(normalizeItem))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      doSearch(val)
    }, 300)
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16 pt-20">
      {/* 搜索框 */}
      <div className="mb-8">
        <h1 className="font-serif-display text-2xl font-bold mb-4 text-foreground">搜索</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="搜索标题、摘要、来源…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/40 focus:border-[var(--color-warm-accent)]/60 transition-colors"
          />
        </div>
      </div>

      {/* 搜索中 */}
      {loading && (
        <p className="text-sm text-muted-foreground text-center py-8">搜索中…</p>
      )}

      {/* 结果列表 */}
      {!loading && hasSearched && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground mb-3">共 {results.length} 条结果</p>
          {results.map((item, i) => (
            <DigestCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}

      {/* 无结果 */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-16">
          <Search className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">没有找到与「{query}」相关的内容</p>
        </div>
      )}

      {/* 初始状态 */}
      {!hasSearched && !loading && (
        <div className="text-center py-16">
          <Search className="size-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground/60 text-sm">输入关键词开始搜索</p>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, Star, Tag, X } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { DigestCard, type DigestItem } from "@/components/digest/digest-card"
import { FavoritesTabs } from "@/components/favorites/favorites-tabs"
import { useReadingPosition } from "@/components/hooks/use-reading-position"

interface FavoriteItem {
  favorite: {
    id: string
    digestItemId: string
    tags: string[]
    note: string
    createdAt: string
  }
  digestItem: {
    id: string
    digestDate: string
    source: string
    title: string
    url: string
    author: string | null
    aiScore: number
    oneLiner: string
    summary: string
    clusterId: string | null
    clusterSources: string[] | null
    createdAt: string
  }
}

export default function FavoritesPage() {
  // 阅读位置记忆
  useReadingPosition("/favorites", "")

  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // 获取收藏列表
  useEffect(() => {
    async function fetchFavorites() {
      try {
        const res = await fetch("/api/favorites")
        const data = await res.json()
        setFavorites(data.favorites || [])
      } catch {
        setFavorites([])
      } finally {
        setLoading(false)
      }
    }
    fetchFavorites()
  }, [])

  // 提取所有标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    favorites.forEach(f => {
      f.favorite.tags?.forEach(t => tagSet.add(t))
    })
    return Array.from(tagSet).sort()
  }, [favorites])

  // 过滤
  const filtered = useMemo(() => {
    return favorites.filter(f => {
      const item = f.digestItem
      // 搜索过滤
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchOneLiner = item.oneLiner.toLowerCase().includes(q)
        const matchSummary = item.summary.toLowerCase().includes(q)
        const matchNote = f.favorite.note?.toLowerCase().includes(q)
        if (!matchTitle && !matchOneLiner && !matchSummary && !matchNote) {
          return false
        }
      }
      // 标签过滤
      if (activeTag) {
        if (!f.favorite.tags?.includes(activeTag)) return false
      }
      return true
    })
  }, [favorites, searchQuery, activeTag])

  // 转换为 DigestItem 格式
  const digestItems: (DigestItem & { note?: string; tags?: string[]; favoriteId: string })[] =
    filtered.map(f => ({
      ...f.digestItem,
      isFavorited: true,
      favoriteId: f.favorite.id,
      note: f.favorite.note,
      tags: f.favorite.tags,
    }))

  // 收藏 Tab 的主体内容（搜索 + 标签 + 列表 / 空态）
  const favoritesContent = favorites.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Star className="size-8 text-muted-foreground" />
      </div>
      <h2 className="font-serif-display text-lg font-semibold text-foreground mb-1">
        暂无收藏
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        在日报中点击星标按钮，即可将感兴趣的资讯添加到收藏
      </p>
    </div>
  ) : (
    <>
      {/* 搜索 + 标签过滤 */}
      <div className="space-y-3 mb-6">
        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索收藏..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-warm-accent)]/30 focus:border-[var(--color-warm-accent)]/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* 标签筛选 */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTag === tag
                    ? "bg-[var(--color-warm-accent)] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tag className="size-3" />
                {tag}
              </button>
            ))}
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" />
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* 收藏列表 */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          没有匹配的收藏
        </p>
      ) : (
        <div className="space-y-3">
          {digestItems.map((item, i) => (
            <div key={item.favoriteId}>
              <DigestCard item={item} index={i} />
              {/* 收藏备注 */}
              {item.note && (
                <div className="ml-[3px] pl-4 mt-1 text-xs text-muted-foreground italic border-l-2 border-border/40">
                  {item.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      {/* 页面标题 */}
      <div className="py-6 text-center">
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          我的收藏
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {favorites.length > 0
            ? `已收藏 ${favorites.length} 条资讯`
            : "收藏值得关注的资讯，方便随时查阅"}
        </p>
      </div>

      <Separator className="mb-6" />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-gentle-pulse text-sm text-muted-foreground">
            加载中...
          </div>
        </div>
      ) : (
        <FavoritesTabs favoritesContent={favoritesContent} />
      )}
    </div>
  )
}

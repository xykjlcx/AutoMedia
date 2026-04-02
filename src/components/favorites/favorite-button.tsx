"use client"

import { useState, useCallback } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  digestItemId: string
  isFavorited: boolean
  favoriteId?: string
  onToggle?: (isFavorited: boolean, favoriteId?: string) => void
}

export function FavoriteButton({
  digestItemId,
  isFavorited: initialFavorited,
  favoriteId: initialFavoriteId,
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [favoriteId, setFavoriteId] = useState(initialFavoriteId)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = useCallback(async () => {
    if (isLoading) return

    // 乐观更新
    const wasFavorited = isFavorited
    setIsFavorited(!wasFavorited)
    setIsAnimating(!wasFavorited)
    setIsLoading(true)

    try {
      if (wasFavorited && favoriteId) {
        // 取消收藏
        await fetch(`/api/favorites/${favoriteId}`, { method: "DELETE" })
        setFavoriteId(undefined)
        onToggle?.(false)
      } else {
        // 添加收藏
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ digestItemId }),
        })
        const data = await res.json()
        setFavoriteId(data.id)
        onToggle?.(true, data.id)
      }
    } catch {
      // 回滚
      setIsFavorited(wasFavorited)
    } finally {
      setIsLoading(false)
      // 动画结束
      setTimeout(() => setIsAnimating(false), 300)
    }
  }, [isFavorited, favoriteId, digestItemId, isLoading, onToggle])

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "relative p-1.5 rounded-md transition-colors",
        "hover:bg-[var(--color-warm-accent)]/10",
        "disabled:opacity-50"
      )}
      aria-label={isFavorited ? "取消收藏" : "收藏"}
    >
      <Star
        className={cn(
          "size-4 transition-colors",
          isFavorited
            ? "fill-[var(--color-warm-gold)] text-[var(--color-warm-gold)]"
            : "text-muted-foreground",
          isAnimating && "animate-star-pop"
        )}
      />
    </button>
  )
}

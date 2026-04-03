"use client"

import { useState, useCallback } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingButtonsProps {
  digestItemId: string
  initialRating?: 'like' | 'dislike' | null
}

export function RatingButtons({ digestItemId, initialRating = null }: RatingButtonsProps) {
  const [rating, setRating] = useState<'like' | 'dislike' | null>(initialRating)
  const [isLoading, setIsLoading] = useState(false)

  const handleRate = useCallback(async (newRating: 'like' | 'dislike') => {
    if (isLoading) return
    const finalRating = rating === newRating ? null : newRating
    setRating(finalRating)
    setIsLoading(true)

    try {
      if (finalRating) {
        await fetch('/api/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ digestItemId, rating: finalRating }),
        })
      }
    } catch {
      setRating(rating)
    } finally {
      setIsLoading(false)
    }
  }, [digestItemId, rating, isLoading])

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => handleRate('like')}
        disabled={isLoading}
        className={cn(
          "p-1 rounded-md transition-colors",
          rating === 'like'
            ? "text-green-600 bg-green-600/10"
            : "text-muted-foreground/40 hover:text-green-600 hover:bg-green-600/10"
        )}
        aria-label="喜欢"
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        onClick={() => handleRate('dislike')}
        disabled={isLoading}
        className={cn(
          "p-1 rounded-md transition-colors",
          rating === 'dislike'
            ? "text-red-500 bg-red-500/10"
            : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
        )}
        aria-label="不喜欢"
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </div>
  )
}

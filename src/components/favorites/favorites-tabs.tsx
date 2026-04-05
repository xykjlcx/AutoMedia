"use client"

import { useState } from 'react'
import { Star, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReadingQueueList } from './reading-queue-list'

interface FavoritesTabsProps {
  favoritesContent: React.ReactNode
}

export function FavoritesTabs({ favoritesContent }: FavoritesTabsProps) {
  const [tab, setTab] = useState<'favorites' | 'queue'>('favorites')

  return (
    <div>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit mb-6">
        <button
          onClick={() => setTab('favorites')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            tab === 'favorites'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className="size-3.5" />
          收藏
        </button>
        <button
          onClick={() => setTab('queue')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            tab === 'queue'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Clock3 className="size-3.5" />
          稍后读
        </button>
      </div>
      {tab === 'favorites' ? favoritesContent : <ReadingQueueList />}
    </div>
  )
}

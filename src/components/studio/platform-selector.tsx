"use client"

import { cn } from '@/lib/utils'

export type Platform = 'xhs' | 'twitter' | 'article'

const platforms: Array<{ key: Platform; label: string; icon: string }> = [
  { key: 'xhs', label: '小红书', icon: '📕' },
  { key: 'twitter', label: 'Twitter', icon: '🐦' },
  { key: 'article', label: '公众号', icon: '📖' },
]

interface PlatformSelectorProps {
  value: Platform
  onChange: (platform: Platform) => void
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
      {platforms.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
            value === p.key
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}

"use client"

import { useState } from "react"
import { ExternalLink, ChevronDown, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"
import { FavoriteButton } from "@/components/favorites/favorite-button"

export interface DigestItem {
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
  isFavorited: boolean
  favoriteId?: string
  isRead?: boolean
  isRecommended?: boolean
}

interface DigestCardProps {
  item: DigestItem
  index?: number
}

export function DigestCard({ item, index = 0 }: DigestCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isRead, setIsRead] = useState(item.isRead ?? false)
  const sourceColor = SOURCE_COLORS[item.source] || "#9C9590"
  const sourceMeta = SOURCE_META[item.source]

  // 跨源讨论标签文案
  const crossSourceLabel = item.clusterSources && item.clusterSources.length > 0
    ? item.clusterSources
        .filter(s => s !== item.source)
        .map(s => SOURCE_META[s]?.name || s)
        .join("、")
    : null

  return (
    <article
      className="animate-card-enter group relative rounded-lg border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: sourceColor,
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="p-4">
        {/* 头部：来源 + 收藏 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* 未读小圆点 */}
            {!isRead && (
              <span
                className="shrink-0 rounded-full"
                style={{ width: 6, height: 6, backgroundColor: "var(--color-warm-accent)" }}
              />
            )}
            {sourceMeta && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span>{sourceMeta.icon}</span>
                <span>{sourceMeta.name}</span>
              </span>
            )}
            {item.author && (
              <span className="text-xs text-muted-foreground">
                · {item.author}
              </span>
            )}
          </div>
          <FavoriteButton
            digestItemId={item.id}
            isFavorited={item.isFavorited}
            favoriteId={item.favoriteId}
          />
        </div>

        {/* 标题 */}
        <h3 className="text-base font-medium leading-snug mb-1.5">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-[var(--color-warm-accent)] transition-colors inline-flex items-start gap-1 group/link"
          >
            <span>{item.title}</span>
            <ExternalLink className="size-3.5 mt-0.5 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity" />
          </a>
        </h3>

        {/* 一句话概述 */}
        <p className="text-sm text-[#6B6560] leading-relaxed mb-2">
          {item.oneLiner}
        </p>

        {/* 跨源讨论标签 */}
        {crossSourceLabel && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-warm-accent)]/8 text-xs text-[var(--color-warm-accent)] font-medium">
              <Users className="size-3" />
              {crossSourceLabel} 也在讨论
            </span>
          </div>
        )}

        {/* 详细摘要（可展开） */}
        <button
          onClick={async () => {
            const next = !expanded
            setExpanded(next)
            // 展开时标记已读
            if (next && !isRead) {
              setIsRead(true)
              await fetch("/api/digest/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [item.id] }),
              })
            }
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{expanded ? "收起详情" : "展开详情"}</span>
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>

        <div className={cn("summary-expand mt-2", expanded && "expanded")}>
          <div>
            <div className="text-sm text-[#6B6560] leading-relaxed pb-1 whitespace-pre-line">
              {item.summary}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

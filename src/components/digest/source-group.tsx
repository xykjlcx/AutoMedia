"use client"

import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"
import { DigestCard, type DigestItem } from "./digest-card"

interface SourceGroupProps {
  source: string
  items: DigestItem[]
  /** 该分组在页面中的索引偏移量，用于计算交错动画延迟 */
  startIndex?: number
}

export function SourceGroup({ source, items, startIndex = 0 }: SourceGroupProps) {
  const color = SOURCE_COLORS[source] || "#9C9590"
  const meta = SOURCE_META[source]

  if (!items.length) return null

  return (
    <section className="mb-10">
      {/* 来源标题 */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-xl leading-none">{meta?.icon || "📄"}</span>
        <div>
          <h2 className="font-serif-display text-lg font-semibold text-foreground tracking-tight">
            {meta?.name || source}
          </h2>
          <div
            className="mt-1 h-0.5 w-12 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      {/* 卡片列表 */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <DigestCard key={item.id} item={item} index={startIndex + i} />
        ))}
      </div>
    </section>
  )
}

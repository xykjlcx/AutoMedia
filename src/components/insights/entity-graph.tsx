"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  User,
  Building2,
  Package,
  Cpu,
  Loader2,
  ExternalLink,
  Network,
  TrendingUp,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"

// ==================== Types ====================

interface Entity {
  id: string
  name: string
  type: string
  firstSeenDate: string
  mentionCount: number
  sources: string[]
}

interface Relation {
  sourceEntityId: string
  targetEntityId: string
  sharedArticles: number
}

interface GraphData {
  entities: Entity[]
  relations: Relation[]
}

interface EntityDetail {
  entity: Entity
  relatedEntities: Array<{
    id: string
    name: string
    type: string
    coOccurrenceCount: number
  }>
  articles: Array<{
    id: string
    title: string
    source: string
    url: string
    oneLiner: string
    digestDate: string
  }>
}

// ==================== Config ====================

const typeConfig: Record<
  string,
  { icon: typeof User; label: string; color: string }
> = {
  person: {
    icon: User,
    label: "人物",
    color: "text-blue-600 dark:text-blue-400",
  },
  company: {
    icon: Building2,
    label: "公司",
    color: "text-purple-600 dark:text-purple-400",
  },
  product: {
    icon: Package,
    label: "产品",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  technology: {
    icon: Cpu,
    label: "技术",
    color: "text-orange-600 dark:text-orange-400",
  },
}

// 计算实体热度
function computeHeat(e: Entity): number {
  return e.sources.length * 2 + e.mentionCount
}

// ==================== Sub-components ====================

function HeroCard({
  entity,
  relatedCount,
  isSelected,
  onClick,
}: {
  entity: Entity
  relatedCount: number
  isSelected: boolean
  onClick: () => void
}) {
  const config = typeConfig[entity.type] || typeConfig.technology
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md",
        isSelected
          ? "border-[var(--color-warm-accent)]/60 shadow-sm ring-1 ring-[var(--color-warm-accent)]/30"
          : "border-border/60 hover:border-[var(--color-warm-accent)]/40",
      )}
    >
      {/* Top: type badge + cross-source indicator */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            config.color,
          )}
        >
          <Icon className="size-3" />
          {config.label}
        </span>
        {entity.sources.length >= 2 && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-warm-accent)]">
            <TrendingUp className="size-3" />
            跨{entity.sources.length}源
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="font-serif-display text-base font-semibold text-foreground mb-2 truncate">
        {entity.name}
      </h3>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{entity.mentionCount} 次提及</span>
        {relatedCount > 0 && <span>{relatedCount} 个关联</span>}
      </div>

      {/* Source dots */}
      {entity.sources.length > 0 && (
        <div className="flex gap-1 mt-2">
          {entity.sources.map(s => (
            <span
              key={s}
              className="size-2 rounded-full"
              style={{ backgroundColor: SOURCE_COLORS[s] || "#9C9590" }}
              title={SOURCE_META[s]?.name || s}
            />
          ))}
        </div>
      )}
    </button>
  )
}

function ListItem({
  entity,
  isSelected,
  onClick,
}: {
  entity: Entity
  isSelected: boolean
  onClick: () => void
}) {
  const config = typeConfig[entity.type] || typeConfig.technology
  const Icon = config.icon
  const firstSource = entity.sources[0]
  const dotColor = firstSource ? SOURCE_COLORS[firstSource] || "#9C9590" : "#9C9590"

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors border-l-2",
        isSelected
          ? "bg-[var(--color-warm-accent)]/10 border-[var(--color-warm-accent)]"
          : "border-transparent hover:bg-muted",
      )}
    >
      <span
        className="size-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <Icon className={cn("size-3.5 shrink-0", config.color)} />
      <span className="flex-1 min-w-0 text-sm text-foreground truncate">
        {entity.name}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {entity.mentionCount}·{entity.sources.length}
      </span>
    </button>
  )
}

function DetailPanel({
  detail,
  loading,
  onSelectEntity,
}: {
  detail: EntityDetail | null
  loading: boolean
  onSelectEntity: (id: string) => void
}) {
  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 text-[var(--color-warm-accent)] animate-spin" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        从左侧选择一个实体查看详情
      </div>
    )
  }

  const { entity, relatedEntities, articles } = detail
  const config = typeConfig[entity.type] || typeConfig.technology
  const Icon = config.icon

  return (
    <div className={cn("space-y-5", loading && "opacity-60 transition-opacity")}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("size-5", config.color)} />
          <h3 className="font-serif-display text-xl font-semibold text-foreground">
            {entity.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn("font-medium", config.color)}>{config.label}</span>
          <span>·</span>
          <span>首次出现 {entity.firstSeenDate}</span>
          <span>·</span>
          <span>{entity.mentionCount} 次提及</span>
          <span>·</span>
          <span>覆盖 {entity.sources.length} 个源</span>
        </div>
      </div>

      {/* Source distribution */}
      {entity.sources.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">源分布</p>
          <div className="flex flex-wrap gap-2">
            {entity.sources.map(s => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs text-foreground"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: SOURCE_COLORS[s] || "#9C9590" }}
                />
                {SOURCE_META[s]?.name || s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related entities */}
      {relatedEntities.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            关联实体 ({relatedEntities.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedEntities.map(r => {
              const rc = typeConfig[r.type] || typeConfig.technology
              const RIcon = rc.icon
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectEntity(r.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-xs text-foreground transition-colors"
                  title={`共现 ${r.coOccurrenceCount} 次`}
                >
                  <RIcon className={cn("size-3", rc.color)} />
                  {r.name}
                  {r.coOccurrenceCount > 1 && (
                    <span className="text-muted-foreground tabular-nums">
                      ·{r.coOccurrenceCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Articles */}
      {articles.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            相关文章 ({articles.length})
          </p>
          <div className="space-y-2">
            {articles.map(a => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card hover:border-[var(--color-warm-accent)]/40 hover:shadow-sm p-3 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-[var(--color-warm-accent)] transition-colors">
                      {a.title}
                    </h4>
                    <ExternalLink className="size-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {a.oneLiner && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {a.oneLiner}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${SOURCE_COLORS[a.source] || "#9C9590"}15`,
                        color: SOURCE_COLORS[a.source] || "#9C9590",
                      }}
                    >
                      {SOURCE_META[a.source]?.icon} {SOURCE_META[a.source]?.name || a.source}
                    </span>
                    <span>{a.digestDate}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Main Component ====================

export function EntityGraph() {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EntityDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [filterType, setFilterType] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"heat" | "recent">("heat")
  const [showLongTail, setShowLongTail] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // 拉取图谱数据
  useEffect(() => {
    let cancelled = false
    async function fetchGraphData() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: "200" })
        const res = await fetch(`/api/insights/graph?${params}`)
        if (!res.ok) throw new Error(`请求失败: ${res.status}`)
        const json = (await res.json()) as GraphData
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchGraphData()
    return () => {
      cancelled = true
    }
  }, [])

  // 选中实体后拉取详情
  const selectEntity = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/insights/entity/${id}`)
      if (!res.ok) throw new Error(`请求失败: ${res.status}`)
      const json = (await res.json()) as EntityDetail
      setDetail(json)
    } catch (err) {
      console.error("fetch entity detail failed:", err)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // 按类型过滤后的实体集合
  const filteredEntities = useMemo(() => {
    if (!data) return []
    let list = data.entities
    if (filterType) list = list.filter(e => e.type === filterType)
    return list
  }, [data, filterType])

  // 按热度/时间排序
  const sortedEntities = useMemo(() => {
    const list = [...filteredEntities]
    if (sortBy === "heat") {
      list.sort((a, b) => computeHeat(b) - computeHeat(a))
    } else {
      list.sort((a, b) => b.firstSeenDate.localeCompare(a.firstSeenDate))
    }
    return list
  }, [filteredEntities, sortBy])

  // 计算每个实体的关联数
  const relatedCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!data) return map
    for (const r of data.relations) {
      map.set(r.sourceEntityId, (map.get(r.sourceEntityId) || 0) + 1)
      map.set(r.targetEntityId, (map.get(r.targetEntityId) || 0) + 1)
    }
    return map
  }, [data])

  // 分层：hero / main / long-tail
  const byHeatAll = useMemo(() => {
    // Hero 基于全量（不受类型过滤影响，让焦点保持稳定？）
    // 按 spec 的表现，hero 区随类型过滤联动更符合用户心智，所以用 filtered
    return [...filteredEntities].sort(
      (a, b) => computeHeat(b) - computeHeat(a),
    )
  }, [filteredEntities])

  const heroEntities = useMemo(() => byHeatAll.slice(0, 4), [byHeatAll])
  const heroIdSet = useMemo(
    () => new Set(heroEntities.map(e => e.id)),
    [heroEntities],
  )

  // 主列表候选：剔除 hero，且（提及 >=2 或 源 >=2），再按当前排序
  const mainListAll = useMemo(() => {
    return sortedEntities.filter(
      e =>
        !heroIdSet.has(e.id) && (e.mentionCount >= 2 || e.sources.length >= 2),
    )
  }, [sortedEntities, heroIdSet])

  // 长尾：单次提及且单源
  const longTailAll = useMemo(() => {
    return sortedEntities.filter(
      e =>
        !heroIdSet.has(e.id) && e.mentionCount < 2 && e.sources.length < 2,
    )
  }, [sortedEntities, heroIdSet])

  // 搜索过滤
  const mainList = useMemo(() => {
    if (!searchQuery.trim()) return mainListAll
    const q = searchQuery.trim().toLowerCase()
    return mainListAll.filter(e => e.name.toLowerCase().includes(q))
  }, [mainListAll, searchQuery])

  const longTail = useMemo(() => {
    if (!searchQuery.trim()) return longTailAll
    const q = searchQuery.trim().toLowerCase()
    return longTailAll.filter(e => e.name.toLowerCase().includes(q))
  }, [longTailAll, searchQuery])

  // 首次加载完自动选中第一个 hero 实体
  useEffect(() => {
    if (!selectedId && heroEntities.length > 0) {
      selectEntity(heroEntities[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroEntities])

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 text-[var(--color-warm-accent)] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!data || data.entities.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        暂无实体数据。运行一次日报生成后，实体将自动提取。
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部：类型过滤 + 查看图谱占位按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setFilterType(null)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              filterType === null
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            全部
          </button>
          {Object.entries(typeConfig).map(([type, config]) => {
            const Icon = config.icon
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1",
                  filterType === type
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3" />
                {config.label}
              </button>
            )
          })}
        </div>

        <button
          disabled
          title="即将上线"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-dashed border-border/60 cursor-not-allowed opacity-50"
        >
          <Network className="size-3.5" />
          查看图谱
        </button>
      </div>

      {/* 今日焦点：Hero 卡片 */}
      {heroEntities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-serif-display text-sm font-semibold text-foreground">
              今日焦点
            </h3>
            <span className="text-xs text-muted-foreground">
              按热度排序 · 前 {heroEntities.length}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {heroEntities.map(entity => (
              <HeroCard
                key={entity.id}
                entity={entity}
                relatedCount={relatedCountMap.get(entity.id) || 0}
                isSelected={selectedId === entity.id}
                onClick={() => selectEntity(entity.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Master-detail 布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* 左侧：实体列表 */}
        <div className="rounded-lg border border-border/60 bg-card p-3 space-y-3 h-fit lg:sticky lg:top-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索实体..."
              className="w-full pl-8 pr-2 py-1.5 rounded-md bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--color-warm-accent)]/40"
            />
          </div>

          {/* 排序切换 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {mainList.length} 个实体
            </span>
            <button
              onClick={() =>
                setSortBy(prev => (prev === "heat" ? "recent" : "heat"))
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowUpDown className="size-3" />
              {sortBy === "heat" ? "热度" : "最新"}
            </button>
          </div>

          {/* 主列表 */}
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {mainList.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {searchQuery ? "未找到匹配实体" : "暂无实体"}
              </div>
            ) : (
              mainList.map(entity => (
                <ListItem
                  key={entity.id}
                  entity={entity}
                  isSelected={selectedId === entity.id}
                  onClick={() => selectEntity(entity.id)}
                />
              ))
            )}
          </div>

          {/* 长尾 */}
          {longTailAll.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <button
                onClick={() => setShowLongTail(v => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <span>仅提及 1 次 ({longTail.length})</span>
                {showLongTail ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>
              {showLongTail && (
                <div className="mt-1 space-y-0.5 max-h-[40vh] overflow-y-auto">
                  {longTail.map(entity => (
                    <ListItem
                      key={entity.id}
                      entity={entity}
                      isSelected={selectedId === entity.id}
                      onClick={() => selectEntity(entity.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧：实体详情 */}
        <div className="rounded-lg border border-border/60 bg-card p-5 min-h-[400px]">
          <DetailPanel
            detail={detail}
            loading={detailLoading}
            onSelectEntity={selectEntity}
          />
        </div>
      </div>
    </div>
  )
}

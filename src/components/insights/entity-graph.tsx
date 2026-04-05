"use client"

import { useState, useEffect } from "react"
import { User, Building2, Package, Cpu, Loader2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS, SOURCE_META } from "@/lib/constants"

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

// 实体类型图标和颜色
const typeConfig: Record<string, { icon: typeof User; label: string; color: string }> = {
  person: { icon: User, label: "人物", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  company: { icon: Building2, label: "公司", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  product: { icon: Package, label: "产品", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  technology: { icon: Cpu, label: "技术", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
}

// 获取实体关联的文章
async function fetchEntityArticles(entityId: string) {
  // 暂时复用 graph API，后续可以单独做
  return []
}

function EntityCard({ entity, relatedCount, onClick }: {
  entity: Entity
  relatedCount: number
  onClick: () => void
}) {
  const config = typeConfig[entity.type] || typeConfig.technology
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border px-3 py-2.5 transition-all hover:shadow-md hover:scale-[1.02]",
        config.color,
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="size-3.5 shrink-0" />
        <span className="text-sm font-medium truncate">{entity.name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs opacity-70">
        <span>{entity.mentionCount} 次提及</span>
        {relatedCount > 0 && <span>{relatedCount} 个关联</span>}
      </div>
      {/* 来源分布 */}
      {entity.sources.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {entity.sources.map(source => (
            <span
              key={source}
              className="size-2 rounded-full"
              style={{ backgroundColor: SOURCE_COLORS[source] || '#9C9590' }}
              title={SOURCE_META[source]?.name || source}
            />
          ))}
        </div>
      )}
    </button>
  )
}

export function EntityGraph() {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)

  useEffect(() => {
    fetchGraphData()
  }, [filterType])

  async function fetchGraphData() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterType) params.set('type', filterType)
      const res = await fetch(`/api/insights/graph?${params}`)
      if (!res.ok) throw new Error(`请求失败: ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 计算每个实体的关联数
  function getRelatedCount(entityId: string): number {
    if (!data) return 0
    return data.relations.filter(
      r => r.sourceEntityId === entityId || r.targetEntityId === entityId
    ).length
  }

  // 获取选中实体的关联实体
  function getRelatedEntities(entityId: string): Entity[] {
    if (!data) return []
    const relatedIds = new Set<string>()
    for (const r of data.relations) {
      if (r.sourceEntityId === entityId) relatedIds.add(r.targetEntityId)
      if (r.targetEntityId === entityId) relatedIds.add(r.sourceEntityId)
    }
    return data.entities.filter(e => relatedIds.has(e.id))
  }

  // 按类型分组
  function groupByType(entities: Entity[]): Record<string, Entity[]> {
    const groups: Record<string, Entity[]> = {}
    for (const entity of entities) {
      if (!groups[entity.type]) groups[entity.type] = []
      groups[entity.type].push(entity)
    }
    return groups
  }

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

  const grouped = groupByType(data.entities)

  return (
    <div className="space-y-4">
      {/* 类型过滤器 */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
        <button
          onClick={() => setFilterType(null)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            filterType === null
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
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
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3" />
              {config.label}
            </button>
          )
        })}
      </div>

      {/* 选中实体的详情 */}
      {selectedEntity && (
        <div className="rounded-lg border border-[var(--color-warm-accent)]/20 bg-[var(--color-warm-accent)]/5 p-4 space-y-3 animate-card-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const config = typeConfig[selectedEntity.type] || typeConfig.technology
                const Icon = config.icon
                return <Icon className="size-4" />
              })()}
              <h3 className="font-medium text-foreground">{selectedEntity.name}</h3>
              <span className="text-xs text-muted-foreground">
                {typeConfig[selectedEntity.type]?.label}
              </span>
            </div>
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              关闭
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>首次出现: {selectedEntity.firstSeenDate}</span>
            <span>{selectedEntity.mentionCount} 次提及</span>
            <span>来源: {selectedEntity.sources.map(s => SOURCE_META[s]?.name || s).join(', ')}</span>
          </div>
          {/* 关联实体 */}
          {getRelatedEntities(selectedEntity.id).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">关联实体：</p>
              <div className="flex flex-wrap gap-2">
                {getRelatedEntities(selectedEntity.id).map(related => (
                  <button
                    key={related.id}
                    onClick={() => setSelectedEntity(related)}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  >
                    {related.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 实体卡片网格 */}
      {Object.entries(grouped)
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([type, entities]) => {
          const config = typeConfig[type] || typeConfig.technology
          const Icon = config.icon
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="size-4 text-[var(--color-warm-accent)]" />
                <h3 className="font-serif-display text-sm font-semibold text-foreground">
                  {config.label}
                </h3>
                <span className="text-xs text-muted-foreground">{entities.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {entities.map(entity => (
                  <EntityCard
                    key={entity.id}
                    entity={entity}
                    relatedCount={getRelatedCount(entity.id)}
                    onClick={() => setSelectedEntity(entity)}
                  />
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}

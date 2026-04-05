"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { X, Network, Info } from "lucide-react"

// 动态导入避免 SSR 问题（react-force-graph 依赖 canvas/window）
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
})

interface Entity {
  id: string
  name: string
  type: string
  mentionCount: number
  sources: string[]
}

interface Relation {
  sourceEntityId: string
  targetEntityId: string
  sharedArticles: number
}

interface GraphDrawerProps {
  open: boolean
  onClose: () => void
  entities: Entity[]
  relations: Relation[]
  filterType: string | null
  initialSelectedId?: string | null
}

// 实体类型颜色（匹配主视图）
const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6", // blue
  company: "#a855f7", // purple
  product: "#10b981", // emerald
  technology: "#f97316", // orange
}

const TYPE_LABELS: Record<string, string> = {
  person: "人物",
  company: "公司",
  product: "产品",
  technology: "技术",
}

export function GraphDrawer({
  open,
  onClose,
  entities,
  relations,
  filterType,
  initialSelectedId,
}: GraphDrawerProps) {
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialSelectedId ?? null,
  )
  // false = 仅展示 2+ 次提及或跨 2+ 源的实体，降低噪声
  const [showAll, setShowAll] = useState(false)

  // 测量容器尺寸
  useEffect(() => {
    if (!open) return
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [open])

  // 准备图谱数据
  const graphData = useMemo(() => {
    let filtered = entities
    if (filterType) {
      filtered = filtered.filter(e => e.type === filterType)
    }
    if (!showAll) {
      filtered = filtered.filter(
        e => e.mentionCount >= 2 || e.sources.length >= 2,
      )
    }

    const nodeIds = new Set(filtered.map(e => e.id))
    const nodes = filtered.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      val: Math.max(1, e.mentionCount + e.sources.length), // 节点大小
      color: TYPE_COLORS[e.type] || "#9ca3af",
      mentionCount: e.mentionCount,
      sources: e.sources,
    }))
    const links = relations
      .filter(
        r => nodeIds.has(r.sourceEntityId) && nodeIds.has(r.targetEntityId),
      )
      .map(r => ({
        source: r.sourceEntityId,
        target: r.targetEntityId,
        value: r.sharedArticles,
      }))
    return { nodes, links }
  }, [entities, relations, filterType, showAll])

  // 选中节点的邻居集合
  const highlightNodes = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const neighbors = new Set<string>([selectedNodeId])
    graphData.links.forEach((link: any) => {
      const src = typeof link.source === "string" ? link.source : link.source?.id
      const tgt = typeof link.target === "string" ? link.target : link.target?.id
      if (src === selectedNodeId) neighbors.add(tgt)
      if (tgt === selectedNodeId) neighbors.add(src)
    })
    return neighbors
  }, [selectedNodeId, graphData.links])

  // 抽屉打开时，若有初始选中节点则居中并放大
  useEffect(() => {
    if (open && initialSelectedId && graphRef.current) {
      setSelectedNodeId(initialSelectedId)
      const timer = setTimeout(() => {
        const node: any = graphData.nodes.find(
          (n: any) => n.id === initialSelectedId,
        )
        if (node && graphRef.current) {
          graphRef.current.centerAt(node.x || 0, node.y || 0, 800)
          graphRef.current.zoom(2, 800)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [open, initialSelectedId, graphData.nodes])

  const selectedEntity = useMemo(
    () => entities.find(e => e.id === selectedNodeId),
    [entities, selectedNodeId],
  )

  if (!open) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full lg:w-[70vw] xl:w-[65vw] bg-background border-l border-border/60 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-[var(--color-warm-accent)]" />
            <h2 className="font-serif-display text-base font-semibold text-foreground">
              实体关系图谱
            </h2>
            <span className="text-xs text-muted-foreground">
              {graphData.nodes.length} 个节点 · {graphData.links.length} 条关系
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => setShowAll(e.target.checked)}
                className="size-3"
              />
              显示全部（含长尾）
            </label>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 画布 */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {dimensions.width > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="transparent"
              nodeCanvasObject={(
                node: any,
                ctx: CanvasRenderingContext2D,
                globalScale: number,
              ) => {
                const label = node.name
                const fontSize = Math.max(10, 14 / globalScale)
                const radius = Math.sqrt(node.val) * 3 + 4
                const isHighlighted =
                  !selectedNodeId || highlightNodes.has(node.id)
                const opacity = isHighlighted ? 1 : 0.15

                // 节点圆
                ctx.globalAlpha = opacity
                ctx.beginPath()
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
                ctx.fillStyle = node.color
                ctx.fill()
                ctx.strokeStyle =
                  node.id === selectedNodeId
                    ? "#e94560"
                    : "rgba(255,255,255,0.3)"
                ctx.lineWidth = node.id === selectedNodeId ? 3 : 1
                ctx.stroke()

                // 标签
                ctx.font = `${fontSize}px -apple-system, sans-serif`
                ctx.textAlign = "center"
                ctx.textBaseline = "top"
                ctx.fillStyle = isHighlighted
                  ? "rgba(0,0,0,0.8)"
                  : "rgba(0,0,0,0.3)"
                ctx.fillText(label, node.x, node.y + radius + 2)
                ctx.globalAlpha = 1
              }}
              linkColor={(link: any) => {
                const src =
                  typeof link.source === "object" ? link.source.id : link.source
                const tgt =
                  typeof link.target === "object" ? link.target.id : link.target
                const isHighlighted =
                  !selectedNodeId ||
                  (highlightNodes.has(src) && highlightNodes.has(tgt))
                return isHighlighted
                  ? "rgba(100,100,100,0.3)"
                  : "rgba(100,100,100,0.05)"
              }}
              linkWidth={(link: any) => Math.min(3, Math.sqrt(link.value || 1))}
              onNodeClick={(node: any) => {
                setSelectedNodeId(node.id === selectedNodeId ? null : node.id)
                if (graphRef.current) {
                  graphRef.current.centerAt(node.x, node.y, 600)
                  graphRef.current.zoom(2, 600)
                }
              }}
              onBackgroundClick={() => setSelectedNodeId(null)}
              cooldownTicks={100}
              enableNodeDrag={true}
            />
          )}

          {/* 空状态 */}
          {graphData.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              暂无数据
            </div>
          )}

          {/* 选中节点信息卡（左下） */}
          {selectedEntity && (
            <div className="absolute bottom-4 left-4 max-w-xs rounded-lg bg-card border border-border shadow-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      TYPE_COLORS[selectedEntity.type] || "#9ca3af",
                  }}
                />
                <span className="font-medium text-sm text-foreground">
                  {selectedEntity.name}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedEntity.mentionCount} 次提及 ·{" "}
                {selectedEntity.sources.length} 个源
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                关联节点: {Math.max(0, highlightNodes.size - 1)} 个
              </div>
            </div>
          )}
        </div>

        {/* 底部：图例 */}
        <div className="px-5 py-2.5 border-t border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">图例:</span>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">
                  {TYPE_LABELS[type]}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="size-3" />
            <span>点击节点高亮 · 拖拽移动 · 滚轮缩放</span>
          </div>
        </div>
      </div>
    </>
  )
}

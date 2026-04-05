import { generateText } from 'ai'
import { getModels } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/utils'
import type { ScoredItem } from './scoring'

export interface ClusteredItem extends ScoredItem {
  clusterId: string
  clusterSources: string[]
}

// 用 AI 判断哪些条目在讨论同一件事
export async function clusterItems(items: ScoredItem[]): Promise<ClusteredItem[]> {
  if (items.length <= 1) {
    return items.map((item, i) => ({
      ...item,
      clusterId: `cluster-${i}`,
      clusterSources: [],
    }))
  }

  const itemList = items.map((item, idx) => (
    `[${idx}] 来源:${item.source} | ${item.title}`
  )).join('\n')

  // 默认每条独立
  const result: ClusteredItem[] = items.map((item, i) => ({
    ...item,
    clusterId: `cluster-${i}`,
    clusterSources: [],
  }))

  try {
    const { text } = await generateText({
      model: getModels().fast,
      prompt: `以下是来自不同平台的资讯标题。请找出讨论同一事件/话题的条目，将它们分组。

${itemList}

请严格只返回 JSON，不要有其他文字：
{"clusters": [[0, 5], [3, 7, 12], ...]}

只需要返回有重复的组（2个及以上条目的组）。如果没有重复，返回 {"clusters": []}`,
    })

    const jsonStr = extractJson(text)
    if (!jsonStr) return result

    const { clusters } = JSON.parse(jsonStr) as { clusters: number[][] }
    const merged = new Set<number>()

    for (const group of clusters) {
      if (group.length < 2) continue

      const sorted = [...group].sort((a, b) => (items[b]?.aiScore || 0) - (items[a]?.aiScore || 0))
      const primaryIdx = sorted[0]
      const clusterId = `cluster-${primaryIdx}`

      const otherSources = sorted.slice(1)
        .map(idx => items[idx]?.source)
        .filter((s): s is string => !!s)

      result[primaryIdx].clusterId = clusterId
      result[primaryIdx].clusterSources = otherSources

      for (const idx of sorted.slice(1)) {
        merged.add(idx)
      }
    }

    return result.filter((_, i) => !merged.has(i))
  } catch (err) {
    console.error('[clustering] 聚类失败，跳过去重:', err)
    return result
  }
}

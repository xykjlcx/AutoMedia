import { getAnthropicClient } from './client'
import type { ScoredItem } from './scoring'

export interface ClusteredItem extends ScoredItem {
  clusterId: string
  clusterSources: string[]
}

// 用 Claude 直接判断哪些条目在讨论同一件事
export async function clusterItems(items: ScoredItem[]): Promise<ClusteredItem[]> {
  if (items.length <= 1) {
    return items.map((item, i) => ({
      ...item,
      clusterId: `cluster-${i}`,
      clusterSources: [],
    }))
  }

  const client = getAnthropicClient()

  const itemList = items.map((item, idx) => (
    `[${idx}] 来源:${item.source} | ${item.title}`
  )).join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `以下是来自不同平台的资讯标题。请找出讨论同一事件/话题的条目，将它们分组。

${itemList}

请严格按 JSON 格式返回分组结果，每组是一个索引数组：
{"clusters": [[0, 5], [3, 7, 12], ...]}

只需要返回有重复的组（2个及以上条目的组）。如果没有重复，返回 {"clusters": []}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  // 默认每条独立
  const result: ClusteredItem[] = items.map((item, i) => ({
    ...item,
    clusterId: `cluster-${i}`,
    clusterSources: [],
  }))

  if (!jsonMatch) return result

  try {
    const { clusters } = JSON.parse(jsonMatch[0]) as { clusters: number[][] }
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
  } catch {
    console.error('[clustering] JSON 解析失败，跳过去重')
    return result
  }
}

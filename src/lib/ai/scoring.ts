import { getAnthropicClient } from './client'
import type { CollectedItem } from '../collectors/types'

export interface ScoredItem extends CollectedItem {
  aiScore: number
  scoreBreakdown: {
    relevance: number
    novelty: number
    impact: number
  }
}

const INTEREST_DOMAINS = [
  'AI / 大模型 / Agent / LLM',
  '跨境电商 / Shopify / 独立站 / DTC',
  '技术变革 / 开发者工具 / 开源',
  '互联网产品 / 创业 / SaaS',
]

// 批量评分，每批 10 条
export async function scoreItems(items: CollectedItem[]): Promise<ScoredItem[]> {
  const client = getAnthropicClient()
  const results: ScoredItem[] = []
  const batchSize = 10

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容摘要:${item.content.slice(0, 300)}`
    )).join('\n\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `你是一个资讯筛选 AI。请对以下资讯条目进行评分。

关注领域：
${INTEREST_DOMAINS.map(d => `- ${d}`).join('\n')}

评分维度（每项 0-10 分）：
- relevance: 与关注领域的匹配度
- novelty: 是否有新信息、新观点
- impact: 对行业/技术的影响程度

请严格按 JSON 数组格式返回，每项包含 index、relevance、novelty、impact 三个分数：
[{"index": 0, "relevance": 8, "novelty": 7, "impact": 6}, ...]

资讯列表：
${itemList}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) continue

    try {
      const scores: Array<{ index: number; relevance: number; novelty: number; impact: number }> = JSON.parse(jsonMatch[0])
      for (const score of scores) {
        const item = batch[score.index]
        if (!item) continue
        const aiScore = score.relevance * 0.4 + score.novelty * 0.3 + score.impact * 0.3
        results.push({
          ...item,
          aiScore: Math.round(aiScore * 10) / 10,
          scoreBreakdown: {
            relevance: score.relevance,
            novelty: score.novelty,
            impact: score.impact,
          },
        })
      }
    } catch {
      console.error('[scoring] JSON 解析失败，跳过当前批次')
    }
  }

  return results
}

// 按源分组，每源取 top 5，且分数 >= 6
export function filterTopItems(items: ScoredItem[], maxPerSource = 5, minScore = 6): ScoredItem[] {
  const bySource = new Map<string, ScoredItem[]>()

  for (const item of items) {
    if (item.aiScore < minScore) continue
    const list = bySource.get(item.source) || []
    list.push(item)
    bySource.set(item.source, list)
  }

  const result: ScoredItem[] = []
  for (const [, list] of bySource) {
    list.sort((a, b) => b.aiScore - a.aiScore)
    result.push(...list.slice(0, maxPerSource))
  }

  return result
}

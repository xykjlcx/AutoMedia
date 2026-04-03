import { generateText } from 'ai'
import { getModels } from './client'
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

// 从 AI 回复中提取 JSON
function extractJson(text: string): string | null {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  // 尝试找 [ ... ] 或 { ... }
  const bracket = text.indexOf('[')
  const lastBracket = text.lastIndexOf(']')
  if (bracket !== -1 && lastBracket > bracket) return text.slice(bracket, lastBracket + 1)
  const brace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (brace !== -1 && lastBrace > brace) return text.slice(brace, lastBrace + 1)
  return null
}

// 批量评分，每批 10 条
export async function scoreItems(
  items: CollectedItem[],
  onProgress?: (done: number) => void,
): Promise<ScoredItem[]> {
  const results: ScoredItem[] = []
  const batchSize = 20

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容摘要:${item.content.slice(0, 300)}`
    )).join('\n\n')

    try {
      const { text } = await generateText({
        model: getModels().fast,
        prompt: `你是一个资讯筛选 AI。请对以下资讯条目进行评分。

关注领域：
${INTEREST_DOMAINS.map(d => `- ${d}`).join('\n')}

评分维度（每项 0-10 分）：
- relevance: 与关注领域的匹配度
- novelty: 是否有新信息、新观点
- impact: 对行业/技术的影响程度

请严格只返回 JSON 数组，不要有其他文字：
[{"index": 0, "relevance": 8, "novelty": 7, "impact": 6}, ...]

资讯列表：
${itemList}`,
      })

      const jsonStr = extractJson(text)
      if (!jsonStr) { console.error('[scoring] 无法提取 JSON'); continue }

      const scores: Array<{ index: number; relevance: number; novelty: number; impact: number }> = JSON.parse(jsonStr)
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
    } catch (err) {
      console.error('[scoring] 评分失败，跳过当前批次:', err)
    }
    // 报告进度：已处理到第几条
    onProgress?.(Math.min(i + batchSize, items.length))
  }

  return results
}

// 按源分组，每源取 top 5，且分数 >= 5（降低阈值保留更多内容）
export function filterTopItems(items: ScoredItem[], maxPerSource = 5, minScore = 5): ScoredItem[] {
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

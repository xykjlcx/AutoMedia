import { generateText } from 'ai'
import { getModels } from './client'
import { extractJson } from './utils'
import { getPreferenceProfile } from './preference'
import type { CollectedItem } from '../collectors/types'

export interface ScoredItem extends CollectedItem {
  aiScore: number
  scoreBreakdown: {
    relevance: number
    novelty: number
    impact: number
  }
}

export interface ScoreResult {
  items: ScoredItem[]
  failedCount: number
}

const INTEREST_DOMAINS = [
  'AI / 大模型 / Agent / LLM',
  '跨境电商 / Shopify / 独立站 / DTC',
  '技术变革 / 开发者工具 / 开源',
  '互联网产品 / 创业 / SaaS',
]

// 批量评分，每批 20 条，最多 2 路并发
export async function scoreItems(
  items: CollectedItem[],
  onProgress?: (done: number) => Promise<void> | void,
): Promise<ScoreResult> {
  const results: ScoredItem[] = []
  let failedCount = 0
  let doneCount = 0
  const batchSize = 20
  const concurrency = 2

  // 获取偏好画像（在循环外只调一次）
  const preferenceProfile = getPreferenceProfile()
  const preferenceSection = preferenceProfile
    ? `\n用户个人偏好（请据此调整评分权重）：\n${preferenceProfile}\n`
    : ''

  // 切分批次
  const batches: CollectedItem[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  // 处理单个批次
  const processBatch = async (batch: CollectedItem[]): Promise<void> => {
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容摘要:${item.content.slice(0, 300)}`
    )).join('\n\n')

    try {
      const { text } = await generateText({
        model: getModels().fast,
        prompt: `你是一个资讯筛选 AI。请对以下资讯条目进行评分。

关注领域：
${INTEREST_DOMAINS.map(d => `- ${d}`).join('\n')}
${preferenceSection}
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
      if (!jsonStr) {
        console.error('[scoring] 无法提取 JSON')
        failedCount += batch.length
        return
      }

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
      failedCount += batch.length
    }
    doneCount += batch.length
    await onProgress?.(Math.min(doneCount, items.length))
  }

  // 并发控制：最多 concurrency 个批次同时执行
  let cursor = 0
  const runNext = async (): Promise<void> => {
    while (cursor < batches.length) {
      const idx = cursor++
      await processBatch(batches[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => runNext()))

  return { items: results, failedCount }
}


import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from './client'
import type { ClusteredItem } from './clustering'

export interface SummarizedItem extends ClusteredItem {
  oneLiner: string
  summary: string
}

const summarySchema = z.array(z.object({
  index: z.number(),
  one_liner: z.string(),
  summary: z.string(),
}))

// 批量生成摘要，每批 5 条
export async function summarizeItems(items: ClusteredItem[]): Promise<SummarizedItem[]> {
  const results: SummarizedItem[] = []
  const batchSize = 5

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容:${item.content.slice(0, 500)}${item.clusterSources.length > 0 ? `\n跨源讨论:${item.clusterSources.join(', ')}` : ''}`
    )).join('\n\n---\n\n')

    try {
      const { object: summaries } = await generateObject({
        model: getModels().quality,
        schema: summarySchema,
        prompt: `你是一个资讯摘要 AI，面向一位关注 AI、跨境电商、技术变革的全栈开发者。

请为以下资讯生成摘要。每条需要：
1. one_liner: 一句话概述（中文，30字以内，概括核心信息）
2. summary: 详细摘要（中文，100-150字，包含关键细节和"为什么值得关注"的解读）

资讯列表：
${itemList}`,
      })

      for (const s of summaries) {
        const item = batch[s.index]
        if (!item) continue
        results.push({
          ...item,
          oneLiner: s.one_liner,
          summary: s.summary,
        })
      }
    } catch (err) {
      console.error('[summarize] 摘要生成失败，使用 fallback:', err)
      // fallback：用标题和内容截取
      for (const item of batch) {
        results.push({
          ...item,
          oneLiner: item.title.slice(0, 30),
          summary: item.content.slice(0, 150),
        })
      }
    }
  }

  return results
}

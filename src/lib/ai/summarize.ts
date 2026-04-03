import { generateText } from 'ai'
import { getModels } from './client'
import { extractJson } from './utils'
import type { ClusteredItem } from './clustering'

export interface SummarizedItem extends ClusteredItem {
  oneLiner: string
  summary: string
}

export interface SummarizeResult {
  items: SummarizedItem[]
  failedCount: number
}

// 批量生成摘要，每批 5 条，最多 2 路并发
export async function summarizeItems(
  items: ClusteredItem[],
  onProgress?: (done: number) => Promise<void> | void,
): Promise<SummarizeResult> {
  const results: SummarizedItem[] = []
  let failedCount = 0
  let doneCount = 0
  const batchSize = 5
  const concurrency = 2

  // 切分批次
  const batches: ClusteredItem[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  // 处理单个批次
  const processBatch = async (batch: ClusteredItem[]): Promise<void> => {
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容:${item.content.slice(0, 500)}${item.clusterSources.length > 0 ? `\n跨源讨论:${item.clusterSources.join(', ')}` : ''}`
    )).join('\n\n---\n\n')

    try {
      const { text } = await generateText({
        model: getModels().quality,
        prompt: `你是一个资讯摘要 AI，面向一位关注 AI、跨境电商、技术变革的全栈开发者。

请为以下资讯生成摘要。每条需要：
1. one_liner: 一句话概述（中文，30字以内，概括核心信息）
2. summary: 详细摘要（中文，100-150字，包含关键细节和"为什么值得关注"的解读）

请严格只返回 JSON 数组，不要有其他文字：
[{"index": 0, "one_liner": "...", "summary": "..."}, ...]

资讯列表：
${itemList}`,
      })

      const jsonStr = extractJson(text)
      if (!jsonStr) {
        failedCount += batch.length
        for (const item of batch) {
          results.push({ ...item, oneLiner: item.title.slice(0, 30), summary: item.content.slice(0, 150) })
        }
        return
      }

      const summaries: Array<{ index: number; one_liner: string; summary: string }> = JSON.parse(jsonStr)
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
      failedCount += batch.length
      for (const item of batch) {
        results.push({ ...item, oneLiner: item.title.slice(0, 30), summary: item.content.slice(0, 150) })
      }
    }
    doneCount += batch.length
    await onProgress?.(Math.min(doneCount, items.length))
  }

  // 并发控制
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

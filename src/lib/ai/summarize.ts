import { getAnthropicClient } from './client'
import type { ClusteredItem } from './clustering'

export interface SummarizedItem extends ClusteredItem {
  oneLiner: string
  summary: string
}

// 批量生成摘要，每批 5 条
export async function summarizeItems(items: ClusteredItem[]): Promise<SummarizedItem[]> {
  const client = getAnthropicClient()
  const results: SummarizedItem[] = []
  const batchSize = 5

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const itemList = batch.map((item, idx) => (
      `[${idx}] 来源:${item.source} | 标题:${item.title}\n内容:${item.content.slice(0, 500)}${item.clusterSources.length > 0 ? `\n跨源讨论:${item.clusterSources.join(', ')}` : ''}`
    )).join('\n\n---\n\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `你是一个资讯摘要 AI，面向一位关注 AI、跨境电商、技术变革的全栈开发者。

请为以下资讯生成摘要。每条需要：
1. one_liner: 一句话概述（中文，30字以内，概括核心信息）
2. summary: 详细摘要（中文，100-150字，包含关键细节和"为什么值得关注"的解读）

请严格按 JSON 数组格式返回：
[{"index": 0, "one_liner": "...", "summary": "..."}, ...]

资讯列表：
${itemList}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) continue
    const jsonMatch = [text.slice(firstBracket, lastBracket + 1)]

    try {
      const summaries: Array<{ index: number; one_liner: string; summary: string }> = JSON.parse(jsonMatch[0])
      for (const s of summaries) {
        const item = batch[s.index]
        if (!item) continue
        results.push({
          ...item,
          oneLiner: s.one_liner,
          summary: s.summary,
        })
      }
    } catch {
      // 解析失败，用标题作为 fallback
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

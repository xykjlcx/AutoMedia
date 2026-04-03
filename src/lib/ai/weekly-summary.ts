import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from './client'
import { db } from '../db/index'
import { digestItems } from '../db/schema'
import { between, desc } from 'drizzle-orm'

const summarySchema = z.object({
  highlights: z.array(z.object({
    title: z.string(),
    insight: z.string(),
    source: z.string(),
  })),
  trends: z.string(),
  outlook: z.string(),
})

export async function generateWeeklySummary(startDate: string, endDate: string) {
  // 查询时间范围内的所有精选条目
  const items = db.select().from(digestItems)
    .where(between(digestItems.digestDate, startDate, endDate))
    .orderBy(desc(digestItems.aiScore))
    .all()

  if (items.length === 0) {
    return { highlights: [], trends: '该时间段内没有数据', outlook: '', stats: { total: 0, sources: {} } }
  }

  // 统计各来源数量
  const sourceStats: Record<string, number> = {}
  for (const item of items) {
    sourceStats[item.source] = (sourceStats[item.source] || 0) + 1
  }

  // 取 top 20 条给 AI 生成综述
  const topItems = items.slice(0, 20)
  const itemList = topItems.map((item, i) =>
    `[${i}] 来源:${item.source} | ${item.title}\n${item.oneLiner}`
  ).join('\n\n')

  try {
    const { object } = await generateObject({
      model: getModels().quality,
      schema: summarySchema,
      prompt: `你是一个资讯分析 AI，面向一位关注 AI、跨境电商、技术变革的全栈开发者。

以下是 ${startDate} 至 ${endDate} 期间的精选资讯（共 ${items.length} 条，展示 Top ${topItems.length}）：

${itemList}

请生成本期汇总：
1. highlights: 3-5 条最值得关注的要闻，每条包含原标题 title、你的洞察 insight（一句话，为什么重要）、来源 source
2. trends: 本期趋势分析（100-200字，这些资讯反映了哪些共同趋势或方向）
3. outlook: 前瞻展望（50-100字，基于这些趋势，接下来值得关注什么）`,
    })

    return {
      ...object,
      stats: { total: items.length, sources: sourceStats },
    }
  } catch (err) {
    console.error('[weekly-summary] 生成失败:', err)
    return {
      highlights: topItems.slice(0, 5).map(item => ({
        title: item.title,
        insight: item.oneLiner,
        source: item.source,
      })),
      trends: '汇总生成失败，显示 Top 5 条目',
      outlook: '',
      stats: { total: items.length, sources: sourceStats },
    }
  }
}

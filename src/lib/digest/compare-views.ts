import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from '@/lib/ai/client'
import { db } from '@/lib/db/index'

// 对比报告的输出结构
const CompareViewSchema = z.object({
  eventSummary: z.string().describe('事件概述，一两句话说明在讨论什么'),
  perspectives: z.array(z.object({
    source: z.string().describe('信息源名称'),
    stance: z.string().describe('立场/角度，如"乐观"、"质疑"、"技术分析"'),
    keyPoints: z.array(z.string()).describe('该源的关键观点'),
  })),
  consensus: z.string().describe('各源共识'),
  disagreements: z.string().describe('各源分歧'),
})

export type CompareViewResult = z.infer<typeof CompareViewSchema>

// 获取同一 cluster 的文章并生成对比分析
export async function generateCompareView(clusterId: string): Promise<CompareViewResult | null> {
  // 查询该 cluster 的所有文章
  const items = db.$client.prepare(`
    SELECT id, source, title, one_liner, summary, cluster_sources, url
    FROM digest_items
    WHERE cluster_id = ?
    ORDER BY ai_score DESC
  `).all(clusterId) as Array<{
    id: string
    source: string
    title: string
    one_liner: string
    summary: string
    cluster_sources: string | null
    url: string
  }>

  if (items.length === 0) return null

  // 主文章 + 通过 cluster_sources 关联的其他文章
  const mainItem = items[0]
  const clusterSources: string[] = mainItem.cluster_sources
    ? JSON.parse(mainItem.cluster_sources)
    : []

  // 如果没有跨源信息，说明不是多源聚类
  if (clusterSources.length === 0 && items.length <= 1) return null

  // 构建文章列表用于 AI 分析
  const articleList = items.map((item, idx) =>
    `[${idx}] 来源:${item.source} | ${item.title}\n摘要:${item.summary}`
  ).join('\n\n---\n\n')

  // 如果 items 只有主文章但有 cluster_sources 标记，补充说明
  const sourceNote = clusterSources.length > 0
    ? `\n注意：该话题还在以下平台有讨论：${clusterSources.join('、')}（已合并去重）`
    : ''

  try {
    const { object } = await generateObject({
      model: getModels().quality,
      schema: CompareViewSchema,
      prompt: `你是一个多视角分析 AI。以下是来自不同信息源、讨论同一事件的资讯。请分析各源的立场差异。
${sourceNote}

文章列表：
${articleList}

请生成：
1. eventSummary：一两句话概述这个事件
2. perspectives：每个源的立场和关键观点
3. consensus：各源的共识点
4. disagreements：各源的分歧点（如果没有明显分歧，说明"各源观点基本一致"并解释为什么）`,
    })

    return object
  } catch (err) {
    console.error(`[compare-views] cluster ${clusterId} 对比生成失败:`, err)
    return null
  }
}

// 获取指定日期的所有多源聚类
export function getMultiSourceClusters(date: string): Array<{
  clusterId: string
  mainTitle: string
  sources: string[]
  itemCount: number
}> {
  // 查找有 cluster_sources 且非空的聚类
  const items = db.$client.prepare(`
    SELECT cluster_id, title, source, cluster_sources
    FROM digest_items
    WHERE digest_date = ? AND cluster_sources IS NOT NULL AND cluster_sources != '[]'
    ORDER BY ai_score DESC
  `).all(date) as Array<{
    cluster_id: string
    title: string
    source: string
    cluster_sources: string
  }>

  return items.map(item => {
    const otherSources: string[] = JSON.parse(item.cluster_sources)
    return {
      clusterId: item.cluster_id,
      mainTitle: item.title,
      sources: [item.source, ...otherSources],
      itemCount: 1 + otherSources.length,
    }
  })
}

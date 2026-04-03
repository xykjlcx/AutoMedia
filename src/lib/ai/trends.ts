import { generateText } from 'ai'
import { getModels } from './client'
import { extractJson } from './utils'
import { db } from '../db/index'

// 分析当天条目与过去 7 天的话题重叠，标记趋势
export async function analyzeTrends(
  date: string,
  currentTitles: Array<{ url: string; title: string; source: string }>
): Promise<Map<string, string>> {
  const trendMap = new Map<string, string>()

  if (currentTitles.length === 0) return trendMap

  // 获取过去 7 天的文章标题
  const recentItems = db.$client.prepare(`
    SELECT title, source, trend_tag FROM digest_items
    WHERE digest_date < ? AND digest_date >= date(?, '-7 days')
    ORDER BY digest_date DESC
    LIMIT 200
  `).all(date, date) as Array<{ title: string; source: string; trend_tag: string | null }>

  if (recentItems.length === 0) return trendMap

  const uniqueTrends = [...new Set(
    recentItems.filter(r => r.trend_tag).map(r => r.trend_tag!)
  )]

  const recentTitleList = recentItems
    .map(r => `[${r.source}] ${r.title}`)
    .join('\n')

  const currentTitleList = currentTitles
    .map((t, i) => `[${i}] [${t.source}] ${t.title}`)
    .join('\n')

  try {
    const { text } = await generateText({
      model: getModels().fast,
      prompt: `你是一个趋势分析 AI。请判断今天的新文章中，哪些话题在过去 7 天也有讨论（即"趋势"话题）。

过去 7 天的文章标题：
${recentTitleList}

${uniqueTrends.length > 0 ? `已识别的趋势标签：${uniqueTrends.join('、')}\n` : ''}
今天的新文章：
${currentTitleList}

请找出今天文章中属于"趋势"的条目（即过去 7 天也有相关讨论的话题），并给出简短的趋势标签（2-5 个字，如"AI Agent"、"Gemma 4"、"跨境合规"）。

如果某条文章延续了已有的趋势标签，请复用该标签保持一致。

请严格只返回 JSON 数组，没有趋势则返回空数组：
[{"index": 0, "tag": "AI Agent"}, ...]`,
    })

    const jsonStr = extractJson(text)
    if (!jsonStr) return trendMap

    const trends: Array<{ index: number; tag: string }> = JSON.parse(jsonStr)
    for (const t of trends) {
      const item = currentTitles[t.index]
      if (item) {
        trendMap.set(item.url, t.tag)
      }
    }
  } catch (err) {
    console.error('[trends] 趋势分析失败:', err)
  }

  return trendMap
}

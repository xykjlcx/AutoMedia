import { generateObject } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { getModels } from '@/lib/ai/client'
import { db } from '../db/index'

const weeklyInsightSchema = z.object({
  highlights: z.array(z.object({
    title: z.string().describe('事件/话题标题'),
    insight: z.string().describe('从系统性视角的洞察，50-80 字'),
    source: z.string().describe('主要来源'),
  })).length(3),
  observation: z.string().describe('一个贯穿这 3 件事的趋势判断或观察，60-120 字'),
  keyEntities: z.array(z.object({
    index: z.number().int().describe('对应输入的实体索引'),
  })).max(5),
})

// 计算本周一（以给定日期为基准，如果 baseDate 是周日，返回上周一到本周日）
export function getWeekRange(baseDate: Date): { start: string; end: string } {
  const d = new Date(baseDate)
  const day = d.getDay() // 0=Sun, 1=Mon
  // 想取的"上周"：以今天往前推 7 天开始的那个周一
  const daysToLastMonday = day === 0 ? 13 : 6 + day
  const start = new Date(d)
  start.setDate(d.getDate() - daysToLastMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function generateWeeklyInsight(weekStart?: string): Promise<{
  weekStart: string
  weekEnd: string
  highlights: Array<{ title: string; insight: string; source: string }>
  observation: string
  keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
} | null> {
  const range = weekStart
    ? { start: weekStart, end: new Date(new Date(weekStart).getTime() + 6 * 86400000).toISOString().slice(0, 10) }
    : getWeekRange(new Date())

  // 查询本周 Top 50 digest_items
  const items = db.$client.prepare(`
    SELECT id, title, source, one_liner as oneLiner, ai_score as aiScore
    FROM digest_items
    WHERE digest_date >= ? AND digest_date <= ?
    ORDER BY ai_score DESC
    LIMIT 50
  `).all(range.start, range.end) as Array<{
    id: string
    title: string
    source: string
    oneLiner: string
    aiScore: number
  }>

  if (items.length === 0) return null

  // 查询本周新增 Top 20 实体（按 mention_count）
  const entities = db.$client.prepare(`
    SELECT te.id, te.name, te.type, te.mention_count as mentionCount
    FROM topic_entities te
    WHERE te.first_seen_date >= ? AND te.first_seen_date <= ?
    ORDER BY te.mention_count DESC
    LIMIT 20
  `).all(range.start, range.end) as Array<{
    id: string
    name: string
    type: string
    mentionCount: number
  }>

  const itemList = items.slice(0, 30).map((it, i) =>
    `[${i}] ${it.source} | ${it.title}\n  ${it.oneLiner}`
  ).join('\n\n')
  const entityList = entities.map((e, i) =>
    `[${i}] ${e.name} (${e.type}, ${e.mentionCount} 次)`
  ).join('\n')

  try {
    const { object } = await generateObject({
      model: getModels().quality,
      schema: weeklyInsightSchema,
      prompt: `你是一个面向全栈独立开发者（关注 AI、跨境电商、技术变革）的资讯分析师。

这是 ${range.start} 至 ${range.end} 这一周的精选资讯（Top 30）：

${itemList}

本周新增的活跃实体（Top 20）：

${entityList}

请从系统性视角分析本周：
- highlights: 3 件最值得关注的事（不是流水汇总，而是挑出真正有信号价值的事）。每件给出 title / insight（50-80字，从"这意味着什么"的角度）/ source
- observation: 贯穿这 3 件事的一个趋势判断（60-120 字）
- keyEntities: 从实体列表中选 3-5 个最值得关注的，用 index 表示

要求：不要泛泛而谈，要有观点；优先选跨行业/跨源的话题；observation 要有前瞻性。`,
    })

    const keyEntities = object.keyEntities
      .map(ke => entities[ke.index])
      .filter(Boolean)

    const content = {
      highlights: object.highlights,
      observation: object.observation,
      keyEntities,
    }

    db.$client.prepare(`
      INSERT INTO weekly_insights (id, week_start, week_end, content, generated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(week_start) DO UPDATE SET
        week_end = excluded.week_end,
        content = excluded.content,
        generated_at = excluded.generated_at
    `).run(
      uuid(),
      range.start,
      range.end,
      JSON.stringify(content),
      new Date().toISOString()
    )

    return { weekStart: range.start, weekEnd: range.end, ...content }
  } catch (err) {
    console.error('[weekly-insight] 生成失败:', err)
    return null
  }
}

export function getWeeklyInsight(weekStart: string) {
  const rows = db.$client.prepare(`
    SELECT week_start as weekStart, week_end as weekEnd, content, generated_at as generatedAt
    FROM weekly_insights WHERE week_start = ?
  `).all(weekStart) as Array<{
    weekStart: string
    weekEnd: string
    content: string
    generatedAt: string
  }>

  if (rows.length === 0) return null
  const row = rows[0]
  return {
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    ...(JSON.parse(row.content) as {
      highlights: Array<{ title: string; insight: string; source: string }>
      observation: string
      keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
    }),
    generatedAt: row.generatedAt,
  }
}

export function getLatestWeeklyInsight() {
  const row = db.$client.prepare(`
    SELECT week_start as weekStart, week_end as weekEnd, content, generated_at as generatedAt
    FROM weekly_insights ORDER BY week_start DESC LIMIT 1
  `).get() as {
    weekStart: string
    weekEnd: string
    content: string
    generatedAt: string
  } | undefined

  if (!row) return null
  return {
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    ...(JSON.parse(row.content) as {
      highlights: Array<{ title: string; insight: string; source: string }>
      observation: string
      keyEntities: Array<{ id: string; name: string; type: string; mentionCount: number }>
    }),
    generatedAt: row.generatedAt,
  }
}

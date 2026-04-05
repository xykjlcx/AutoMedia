import { generateObject } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { getModels } from '@/lib/ai/client'
import { db } from '../db/index'
import { digestItems } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// TL;DR schema：AI 从 Top 20 里挑 3 条
const tldrSchema = z.object({
  headline: z.string().describe('20 字以内的总纲，概括今天最重要的信号'),
  items: z.array(z.object({
    digestItemIndex: z.number().int().describe('输入列表中的索引'),
    why: z.string().describe('为什么这件事重要，30-50 字'),
  })).length(3),
  observation: z.string().describe('贯穿这 3 件事的一个观察或思考，30-80 字'),
})

export async function generateDailyTldr(date: string): Promise<{
  headline: string
  items: Array<{ title: string; why: string; digestItemId: string }>
  observation: string
} | null> {
  // 取当天 Top 20 推荐条目
  const items = db.select().from(digestItems)
    .where(eq(digestItems.digestDate, date))
    .orderBy(desc(digestItems.aiScore))
    .limit(20)
    .all()

  if (items.length === 0) return null

  const itemList = items.map((it, i) =>
    `[${i}] 来源:${it.source} | ${it.title}\n  ${it.oneLiner}`
  ).join('\n\n')

  try {
    const { object } = await generateObject({
      model: getModels().quality,
      schema: tldrSchema,
      prompt: `你是一个面向全栈独立开发者（关注 AI、跨境电商、技术变革）的资讯总编。

以下是 ${date} 的精选资讯（共 ${items.length} 条）：

${itemList}

请从中挑出 3 件最值得关注的事，生成今日三件事简报：
- headline: 用 20 字以内概括今天最核心的信号
- items: 挑出 3 件事（按重要性降序），每件给出 digestItemIndex（对应上面列表的索引）和 why（30-50 字说明为什么重要）
- observation: 给出一个贯穿这 3 件事的思考或判断，30-80 字

要求：items 必须恰好 3 条；优先选评分高、跨源程度高、趋势性强的话题。`,
    })

    const selected = object.items.map(it => ({
      title: items[it.digestItemIndex]?.title || '',
      why: it.why,
      digestItemId: items[it.digestItemIndex]?.id || '',
    })).filter(x => x.digestItemId)

    if (selected.length === 0) return null

    const result = {
      headline: object.headline,
      items: selected,
      observation: object.observation,
    }

    // 写入数据库（UNIQUE 覆盖）
    db.$client.prepare(`
      INSERT INTO daily_tldrs (id, digest_date, headline, items, observation, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(digest_date) DO UPDATE SET
        headline = excluded.headline,
        items = excluded.items,
        observation = excluded.observation,
        generated_at = excluded.generated_at
    `).run(
      uuid(),
      date,
      result.headline,
      JSON.stringify(result.items),
      result.observation,
      new Date().toISOString()
    )

    return result
  } catch (err) {
    console.error('[tldr] 生成失败:', err)
    return null
  }
}

export function getDailyTldr(date: string) {
  const rows = db.$client.prepare(`
    SELECT digest_date as digestDate, headline, items, observation, generated_at as generatedAt
    FROM daily_tldrs WHERE digest_date = ?
  `).all(date) as Array<{
    digestDate: string
    headline: string
    items: string
    observation: string
    generatedAt: string
  }>

  if (rows.length === 0) return null
  const row = rows[0]
  return {
    digestDate: row.digestDate,
    headline: row.headline,
    items: JSON.parse(row.items) as Array<{ title: string; why: string; digestItemId: string }>,
    observation: row.observation,
    generatedAt: row.generatedAt,
  }
}

import { generateObject } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { getModels } from '@/lib/ai/client'
import { db } from '@/lib/db/index'

// AI 提取的实体结构
const EntitySchema = z.object({
  entities: z.array(z.object({
    name: z.string().describe('实体名称，英文保持原文，中文保持中文'),
    type: z.enum(['person', 'company', 'product', 'technology']),
    relation: z.enum(['mentions', 'about', 'related']).describe('与文章的关系类型'),
  })),
})

interface DigestItemForExtraction {
  id: string
  title: string
  oneLiner: string
  summary: string
  source: string
}

// 从已摘要的文章中提取实体
export async function extractEntities(
  items: DigestItemForExtraction[],
  date: string,
): Promise<{ entityCount: number; relationCount: number }> {
  if (items.length === 0) return { entityCount: 0, relationCount: 0 }

  let totalEntities = 0
  let totalRelations = 0
  const now = new Date().toISOString()

  // 分批处理，每批 10 条
  const batchSize = 10
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)

    const itemList = batch.map((item, idx) =>
      `[${idx}] 来源:${item.source} | ${item.title}\n摘要:${item.oneLiner}`
    ).join('\n\n')

    try {
      const { object } = await generateObject({
        model: getModels().fast,
        schema: EntitySchema,
        prompt: `你是一个实体提取 AI。请从以下资讯中提取关键实体（人物、公司、产品、技术）。

规则：
- 只提取有实际意义的实体，忽略泛化概念（如"人工智能"太泛，但"GPT-5"具体）
- 人物：创始人、CEO、知名开发者等
- 公司：科技公司、创业公司等
- 产品：具体产品、工具、服务
- 技术：框架、协议、算法等
- 每条资讯提取 1-5 个实体
- relation 说明：about = 文章主要讨论这个实体，mentions = 文章提到但非主题，related = 间接相关

资讯列表：
${itemList}`,
      })

      // 写入数据库（事务）
      const insertEntity = db.$client.prepare(`
        INSERT INTO topic_entities (id, name, type, first_seen_date, mention_count, updated_at)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          mention_count = mention_count + 1,
          updated_at = ?
      `)

      const findEntity = db.$client.prepare(`
        SELECT id FROM topic_entities WHERE name = ? AND type = ?
      `)

      const insertRelation = db.$client.prepare(`
        INSERT INTO article_relations (id, digest_item_id, entity_id, relation_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)

      // 检查已有关联，避免重复
      const checkRelation = db.$client.prepare(`
        SELECT id FROM article_relations WHERE digest_item_id = ? AND entity_id = ?
      `)

      const transaction = db.$client.transaction(() => {
        for (const entity of object.entities) {
          // 查找或创建实体
          const existing = findEntity.get(entity.name, entity.type) as { id: string } | undefined
          let entityId: string

          if (existing) {
            entityId = existing.id
            // 更新提及次数
            insertEntity.run(entityId, entity.name, entity.type, date, 1, now, now)
          } else {
            entityId = uuid()
            insertEntity.run(entityId, entity.name, entity.type, date, 1, now, now)
            totalEntities++
          }

          // 为当前批次中的每篇文章建立关联
          for (const item of batch) {
            const existingRelation = checkRelation.get(item.id, entityId)
            if (!existingRelation) {
              insertRelation.run(uuid(), item.id, entityId, entity.relation, now)
              totalRelations++
            }
          }
        }
      })

      transaction()
    } catch (err) {
      console.error(`[entity-extract] 批次 ${i} 提取失败:`, err)
    }
  }

  return { entityCount: totalEntities, relationCount: totalRelations }
}

// 为指定日期的已有文章提取实体（手动触发用）
export async function extractEntitiesForDate(date: string): Promise<{ entityCount: number; relationCount: number }> {
  const items = db.$client.prepare(`
    SELECT id, title, one_liner as oneLiner, summary, source
    FROM digest_items WHERE digest_date = ?
  `).all(date) as DigestItemForExtraction[]

  return extractEntities(items, date)
}

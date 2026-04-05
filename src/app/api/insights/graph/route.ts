import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'

// 获取知识图谱数据：实体 + 关联关系
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const type = searchParams.get('type') // 可选：按类型过滤

  // 查询实体
  const whereClause = type ? 'WHERE te.type = ?' : ''
  const params = type ? [type, limit] : [limit]

  const entities = db.$client.prepare(`
    SELECT
      te.id, te.name, te.type, te.first_seen_date, te.mention_count, te.updated_at,
      GROUP_CONCAT(DISTINCT di.source) as sources
    FROM topic_entities te
    LEFT JOIN article_relations ar ON ar.entity_id = te.id
    LEFT JOIN digest_items di ON di.id = ar.digest_item_id
    ${whereClause}
    GROUP BY te.id
    ORDER BY te.mention_count DESC
    LIMIT ?
  `).all(...params) as Array<{
    id: string
    name: string
    type: string
    first_seen_date: string
    mention_count: number
    updated_at: string
    sources: string | null
  }>

  // 查询关联关系（两个实体出现在同一篇文章中 = 有关联）
  const relations = db.$client.prepare(`
    SELECT
      ar1.entity_id as source_entity_id,
      ar2.entity_id as target_entity_id,
      COUNT(DISTINCT ar1.digest_item_id) as shared_articles
    FROM article_relations ar1
    JOIN article_relations ar2 ON ar1.digest_item_id = ar2.digest_item_id
      AND ar1.entity_id < ar2.entity_id
    GROUP BY ar1.entity_id, ar2.entity_id
    HAVING shared_articles >= 1
    ORDER BY shared_articles DESC
    LIMIT 200
  `).all() as Array<{
    source_entity_id: string
    target_entity_id: string
    shared_articles: number
  }>

  // 格式化实体数据
  const formattedEntities = entities.map(e => ({
    id: e.id,
    name: e.name,
    type: e.type,
    firstSeenDate: e.first_seen_date,
    mentionCount: e.mention_count,
    sources: e.sources ? e.sources.split(',') : [],
  }))

  return NextResponse.json({
    entities: formattedEntities,
    relations: relations.map(r => ({
      sourceEntityId: r.source_entity_id,
      targetEntityId: r.target_entity_id,
      sharedArticles: r.shared_articles,
    })),
  })
}

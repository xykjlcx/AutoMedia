import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'

// 获取单个实体的详情：基础信息、关联实体、相关文章
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: '缺少实体 id' }, { status: 400 })
  }

  // 1) 实体本身 + 源分布
  const entityRow = db.$client.prepare(`
    SELECT
      te.id, te.name, te.type, te.first_seen_date, te.mention_count, te.updated_at,
      GROUP_CONCAT(DISTINCT di.source) as sources
    FROM topic_entities te
    LEFT JOIN article_relations ar ON ar.entity_id = te.id
    LEFT JOIN digest_items di ON di.id = ar.digest_item_id
    WHERE te.id = ?
    GROUP BY te.id
  `).get(id) as
    | {
        id: string
        name: string
        type: string
        first_seen_date: string
        mention_count: number
        updated_at: string
        sources: string | null
      }
    | undefined

  if (!entityRow) {
    return NextResponse.json({ error: '实体不存在' }, { status: 404 })
  }

  // 2) 关联实体：与该实体出现在同一篇文章中的其它实体，按共现次数倒序
  const relatedRows = db.$client.prepare(`
    SELECT
      te.id, te.name, te.type,
      COUNT(DISTINCT ar2.digest_item_id) as co_occurrence_count
    FROM article_relations ar1
    JOIN article_relations ar2 ON ar1.digest_item_id = ar2.digest_item_id
      AND ar2.entity_id <> ar1.entity_id
    JOIN topic_entities te ON te.id = ar2.entity_id
    WHERE ar1.entity_id = ?
    GROUP BY te.id
    ORDER BY co_occurrence_count DESC, te.mention_count DESC
    LIMIT 20
  `).all(id) as Array<{
    id: string
    name: string
    type: string
    co_occurrence_count: number
  }>

  // 3) 相关文章：所有通过 article_relations 链接到该实体的 digest_items
  const articleRows = db.$client.prepare(`
    SELECT
      di.id, di.title, di.source, di.url, di.one_liner, di.digest_date
    FROM article_relations ar
    JOIN digest_items di ON di.id = ar.digest_item_id
    WHERE ar.entity_id = ?
    ORDER BY di.digest_date DESC, di.ai_score DESC
    LIMIT 30
  `).all(id) as Array<{
    id: string
    title: string
    source: string
    url: string
    one_liner: string
    digest_date: string
  }>

  return NextResponse.json({
    entity: {
      id: entityRow.id,
      name: entityRow.name,
      type: entityRow.type,
      firstSeenDate: entityRow.first_seen_date,
      mentionCount: entityRow.mention_count,
      sources: entityRow.sources ? entityRow.sources.split(',').filter(Boolean) : [],
    },
    relatedEntities: relatedRows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      coOccurrenceCount: r.co_occurrence_count,
    })),
    articles: articleRows.map(a => ({
      id: a.id,
      title: a.title,
      source: a.source,
      url: a.url,
      oneLiner: a.one_liner,
      digestDate: a.digest_date,
    })),
  })
}

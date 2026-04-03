import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { digestItems } from '@/lib/db/schema'
import { inArray, sql } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const limit = parseInt(searchParams.get('limit') || '20')

  if (!query) {
    return NextResponse.json({ results: [] })
  }

  try {
    // FTS5 搜索，使用底层 better-sqlite3 实例同步查询
    const ftsRows = db.$client
      .prepare('SELECT digest_item_id, rank FROM digest_fts WHERE digest_fts MATCH ? ORDER BY rank LIMIT ?')
      .all(query, limit) as { digest_item_id: string; rank: number }[]

    if (ftsRows.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // 批量查询，避免 N+1
    const ids = ftsRows.map(r => r.digest_item_id)
    const allItems = await db.select().from(digestItems).where(inArray(digestItems.id, ids))

    // 按 FTS rank 顺序排列
    const itemMap = new Map(allItems.map(item => [item.id, item]))
    const items = ftsRows.map(r => itemMap.get(r.digest_item_id)).filter(Boolean)

    return NextResponse.json({ results: items, total: items.length })
  } catch (err) {
    // FTS 查询语法错误时 fallback 到 LIKE 搜索
    const likePattern = `%${query}%`
    const items = db.$client
      .prepare('SELECT * FROM digest_items WHERE title LIKE ? OR one_liner LIKE ? OR summary LIKE ? LIMIT ?')
      .all(likePattern, likePattern, likePattern, limit)

    return NextResponse.json({ results: items, total: (items as unknown[]).length })
  }
}

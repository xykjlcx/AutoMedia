import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { digestItems } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

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

    // 按 FTS rank 顺序获取完整的 digest items
    const items = []
    for (const row of ftsRows) {
      const rows = await db.select().from(digestItems).where(eq(digestItems.id, row.digest_item_id))
      if (rows[0]) items.push(rows[0])
    }

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

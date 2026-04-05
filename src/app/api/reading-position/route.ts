import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { readingPosition } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

// 获取阅读位置
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    const key = searchParams.get('key') || ''

    if (!path) {
      return NextResponse.json({ error: '缺少 path 参数' }, { status: 400 })
    }

    const result = db
      .select()
      .from(readingPosition)
      .where(
        and(
          eq(readingPosition.pagePath, path),
          eq(readingPosition.pageKey, key),
        )
      )
      .get()

    return NextResponse.json({ scrollY: result?.scrollY ?? 0 })
  } catch (err) {
    console.error('[reading-position] GET 失败:', err)
    return NextResponse.json({ scrollY: 0 })
  }
}

// 保存阅读位置
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { path, key = '', scrollY } = body

    if (!path || scrollY === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 查找已有记录
    const existing = db
      .select()
      .from(readingPosition)
      .where(
        and(
          eq(readingPosition.pagePath, path),
          eq(readingPosition.pageKey, key),
        )
      )
      .get()

    if (existing) {
      // 更新
      db.update(readingPosition)
        .set({ scrollY, updatedAt: now })
        .where(eq(readingPosition.id, existing.id))
        .run()
    } else {
      // 插入
      db.insert(readingPosition)
        .values({
          id: uuid(),
          pagePath: path,
          pageKey: key,
          scrollY,
          updatedAt: now,
        })
        .run()
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reading-position] POST 失败:', err)
    return NextResponse.json({ error: '保存失败' }, { status: 500 })
  }
}

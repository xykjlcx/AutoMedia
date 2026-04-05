// ============================================================================
// 设计说明：单用户本地工具（Single-User Design）
// 本路由不做身份校验，因为 AutoMedia 当前设计为个人本地运行。
// 多用户部署时需要：1) 注入当前用户身份；2) 把 ownerId 传入 queries 层；
// 3) 在 list/create 时按 ownerId 过滤与绑定。详见 src/lib/studio/queries.ts 顶部。
// ============================================================================

import { NextResponse } from 'next/server'
import { createDraft, listDrafts } from '@/lib/studio/queries'

export async function GET() {
  const items = listDrafts()
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { platform, title, content, sourceItemIds } = body

  if (!platform || !['xhs', 'twitter', 'article'].includes(platform)) {
    return NextResponse.json({ error: '无效的平台' }, { status: 400 })
  }

  const id = createDraft({ platform, title, content, sourceItemIds })
  return NextResponse.json({ id })
}

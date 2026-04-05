// ============================================================================
// 设计说明：单用户本地工具（Single-User Design）
// 本路由不做身份校验与所有权检查，因为 AutoMedia 当前设计为个人本地运行。
// 多用户部署时需要：1) 注入当前用户身份；2) 每个读写操作前校验草稿归属；
// 3) queries 层追加 ownerId 参数。详见 src/lib/studio/queries.ts 顶部。
// ============================================================================

import { NextResponse } from 'next/server'
import { getDraft, updateDraft, deleteDraft, syncDraftSources } from '@/lib/studio/queries'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const draft = getDraft(id)
  if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
  return NextResponse.json(draft)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // 素材列表走独立的 sync 流程；其余字段（title / content / platform / status / aiPrompt）走 updateDraft
  const { sourceItemIds, ...rest } = body ?? {}
  updateDraft(id, rest)
  if (Array.isArray(sourceItemIds)) {
    syncDraftSources(id, sourceItemIds)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteDraft(id)
  return NextResponse.json({ ok: true })
}

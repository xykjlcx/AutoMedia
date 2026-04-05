// ============================================================================
// 设计说明：单用户本地工具（Single-User Design）
// 本路由刻意不做身份校验与所有权检查，因为 AutoMedia 设计为个人本地运行。
//
// ⚠️ 部署安全要求：正因为没有认证层，部署时必须保证服务只对 loopback（127.0.0.1）可达。
//   - Docker：docker-compose.yml 已将端口映射为 "127.0.0.1:3000:3000"，切勿改回 "3000:3000"
//   - 裸机：Next.js 启动时绑定 localhost，或放在带认证的反向代理（Caddy/Nginx/Tailscale）后面
//   - 不要把本服务暴露到公网或共享局域网，否则任何人都能读写/删除草稿
//
// 多用户部署时需要的最小改动：
//   1) 注入当前用户身份（中间件或 session）
//   2) 每个读写操作前校验草稿归属（getDraft → ownerId 比对）
//   3) queries 层追加 ownerId 参数，所有 WHERE 带上该条件
// 详见 src/lib/studio/queries.ts 顶部。
// ============================================================================

import { NextResponse } from 'next/server'
import { getDraft, updateDraftWithSources, deleteDraft } from '@/lib/studio/queries'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const draft = getDraft(id)
  if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
  return NextResponse.json(draft)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // 字段更新与素材同步必须在同一事务内完成，避免前者成功后者失败导致不一致状态
  const { sourceItemIds, ...rest } = body ?? {}
  updateDraftWithSources(id, rest, Array.isArray(sourceItemIds) ? sourceItemIds : undefined)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteDraft(id)
  return NextResponse.json({ ok: true })
}

// ============================================================================
// 设计说明：单用户本地工具（Single-User Design）
// 本路由刻意不做身份校验，因为 AutoMedia 设计为个人本地运行。
//
// ⚠️ 部署安全要求：正因为没有认证层，部署时必须保证服务只对 loopback（127.0.0.1）可达。
//   - Docker：docker-compose.yml 已将端口映射为 "127.0.0.1:3000:3000"，切勿改回 "3000:3000"
//   - 裸机：Next.js 启动时绑定 localhost，或放在带认证的反向代理（Caddy/Nginx/Tailscale）后面
//   - 不要把本服务暴露到公网或共享局域网，否则任何人都能读写草稿
//
// 多用户部署时需要的最小改动：
//   1) 注入当前用户身份（中间件或 session）
//   2) 把 ownerId 传入 queries 层，所有读写按 ownerId 过滤
//   3) schema 增加 owner_id 列并回填历史数据
// 详见 src/lib/studio/queries.ts 顶部。
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

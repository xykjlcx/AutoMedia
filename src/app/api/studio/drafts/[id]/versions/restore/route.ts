import { NextRequest, NextResponse } from 'next/server'
import { restoreVersion } from '@/lib/studio/versions'

// 回滚到指定版本（会先自动 snapshot 当前内容）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const versionId = body?.versionId
  if (!versionId) {
    return NextResponse.json({ error: '缺少 versionId' }, { status: 400 })
  }
  const ok = restoreVersion(id, versionId)
  if (!ok) {
    return NextResponse.json({ error: '版本不存在或不属于该草稿' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

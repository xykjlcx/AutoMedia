import { NextRequest, NextResponse } from 'next/server'
import { listVersions, snapshotDraft, type VersionSource } from '@/lib/studio/versions'

// 获取草稿的所有版本
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const versions = listVersions(id)
  return NextResponse.json({ versions })
}

// 手动创建一个版本快照
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const source: VersionSource = body?.source === 'manual_save' ? 'manual_save' : 'manual_save'
  const versionId = snapshotDraft(id, source)
  if (!versionId) {
    return NextResponse.json({ error: '草稿内容为空，无法保存版本' }, { status: 400 })
  }
  return NextResponse.json({ id: versionId })
}

import { NextRequest, NextResponse } from 'next/server'
import { deleteVersion } from '@/lib/studio/versions'

// 删除指定版本
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { versionId } = await params
  deleteVersion(versionId)
  return NextResponse.json({ ok: true })
}

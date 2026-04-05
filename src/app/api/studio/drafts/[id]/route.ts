import { NextResponse } from 'next/server'
import { getDraft, updateDraft, deleteDraft } from '@/lib/studio/queries'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const draft = getDraft(id)
  if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
  return NextResponse.json(draft)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  updateDraft(id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteDraft(id)
  return NextResponse.json({ ok: true })
}

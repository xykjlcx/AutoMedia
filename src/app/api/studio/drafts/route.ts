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

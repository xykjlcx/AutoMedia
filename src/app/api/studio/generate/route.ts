import { NextResponse } from 'next/server'
import { generateContent } from '@/lib/studio/generator'

export async function POST(req: Request) {
  const { draftId } = await req.json()

  if (!draftId) {
    return NextResponse.json({ error: '缺少 draftId' }, { status: 400 })
  }

  try {
    const result = await generateContent(draftId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

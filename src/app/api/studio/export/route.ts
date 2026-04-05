import { NextResponse } from 'next/server'
import { exportToHtml, exportToMarkdown } from '@/lib/studio/exporter'

export async function POST(req: Request) {
  const { draftId, format = 'html' } = await req.json()

  if (!draftId) {
    return NextResponse.json({ error: '缺少 draftId' }, { status: 400 })
  }

  try {
    if (format === 'markdown') {
      const content = exportToMarkdown(draftId)
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="export.md"`,
        },
      })
    }

    const html = exportToHtml(draftId)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="export.html"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

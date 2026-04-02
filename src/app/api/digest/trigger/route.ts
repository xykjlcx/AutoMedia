import { NextResponse } from 'next/server'
import { runDigestPipeline, isDigestRunning } from '@/lib/pipeline'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const date = (body as { date?: string }).date || new Date().toISOString().slice(0, 10)

  // 并发保护
  if (await isDigestRunning(date)) {
    return NextResponse.json({ date, message: '当天日报正在生成中' }, { status: 409 })
  }

  // 异步执行，不阻塞响应
  runDigestPipeline(date)
    .catch(err => console.error('[trigger] Pipeline error:', err))

  return NextResponse.json({ date, message: '日报生成已启动' })
}

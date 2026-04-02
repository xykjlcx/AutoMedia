import { NextResponse } from 'next/server'
import { runDigestPipeline } from '@/lib/pipeline'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const date = (body as { date?: string }).date || new Date().toISOString().slice(0, 10)

  // 异步执行，不阻塞响应
  runDigestPipeline(date)
    .catch(err => console.error('[trigger] Pipeline error:', err))

  return NextResponse.json({ date, message: '日报生成已启动' })
}

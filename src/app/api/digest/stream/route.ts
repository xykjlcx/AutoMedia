import { pipelineEvents } from '@/lib/pipeline-events'
import { getDigestRunStatus } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // 连接已关闭
        }
      }

      // 立即推送当前状态
      const snapshot = pipelineEvents.getSnapshot(date)
      if (snapshot) {
        send({ type: 'progress', ...snapshot })
      } else {
        // 从 DB 查最新状态
        getDigestRunStatus(date).then(runs => {
          if (runs.length > 0) {
            const run = runs[0]
            send({
              type: 'progress',
              runId: run.id,
              date: run.digestDate,
              progress: run.progress,
              status: run.status,
              rawCount: run.rawCount,
              filteredCount: run.filteredCount,
              errors: run.errors,
            })
          } else {
            send({ type: 'status', status: 'none', date })
          }
        })
      }

      // 监听后续进度事件
      const onProgress = (data: { runId: string; date: string; progress: unknown }) => {
        if (data.date === date) {
          send({ type: 'progress', ...data })
        }
      }

      pipelineEvents.on('progress', onProgress)

      // 心跳保活（每 30 秒）
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      // 客户端断开时清理
      request.signal.addEventListener('abort', () => {
        pipelineEvents.off('progress', onProgress)
        clearInterval(heartbeat)
        try { controller.close() } catch { /* 已关闭 */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}

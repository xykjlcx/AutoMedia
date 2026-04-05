export interface BatchOptions<T, R> {
  items: T[]
  batchSize: number
  concurrency: number
  process: (batch: T[]) => Promise<R[]>
  onProgress?: (done: number) => Promise<void> | void
}

export interface BatchResult<R> {
  results: R[]
  failedCount: number
}

// 通用批处理：切分批次 + 并发控制 + 错误隔离
export async function batchProcess<T, R>(opts: BatchOptions<T, R>): Promise<BatchResult<R>> {
  const { items, batchSize, concurrency, process, onProgress } = opts
  const results: R[] = []
  let failedCount = 0
  let doneCount = 0

  // 切分批次
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  // 并发控制
  let cursor = 0
  const runNext = async (): Promise<void> => {
    while (cursor < batches.length) {
      const idx = cursor++
      const batch = batches[idx]
      try {
        const batchResults = await process(batch)
        results.push(...batchResults)
      } catch (err) {
        console.error(`[batch] 批次 ${idx} 处理失败:`, err)
        failedCount += batch.length
      }
      doneCount += batch.length
      await onProgress?.(Math.min(doneCount, items.length))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, () => runNext())
  )

  return { results, failedCount }
}

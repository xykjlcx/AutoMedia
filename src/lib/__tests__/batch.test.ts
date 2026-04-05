import { describe, it, expect, vi } from 'vitest'
import { batchProcess } from '../ai/batch'

describe('batchProcess', () => {
  it('处理所有条目并返回结果', async () => {
    const items = [1, 2, 3, 4, 5]
    const result = await batchProcess({
      items,
      batchSize: 2,
      concurrency: 1,
      process: async (batch) => batch.map(n => n * 2),
    })
    expect(result.results).toEqual([2, 4, 6, 8, 10])
    expect(result.failedCount).toBe(0)
  })

  it('并发控制：concurrency=2 时两个批次同时执行', async () => {
    let maxConcurrent = 0
    let running = 0
    const items = [1, 2, 3, 4, 5, 6]

    await batchProcess({
      items,
      batchSize: 2,
      concurrency: 2,
      process: async (batch) => {
        running++
        maxConcurrent = Math.max(maxConcurrent, running)
        await new Promise(r => setTimeout(r, 50))
        running--
        return batch
      },
    })
    expect(maxConcurrent).toBe(2)
  })

  it('某批次失败时记录 failedCount 并继续处理', async () => {
    const items = [1, 2, 3, 4]
    const result = await batchProcess({
      items,
      batchSize: 2,
      concurrency: 1,
      process: async (batch) => {
        if (batch.includes(3)) throw new Error('test error')
        return batch.map(n => n * 10)
      },
    })
    expect(result.results).toEqual([10, 20])
    expect(result.failedCount).toBe(2)
  })

  it('调用 onProgress 回调', async () => {
    const progress: number[] = []
    await batchProcess({
      items: [1, 2, 3],
      batchSize: 1,
      concurrency: 1,
      process: async (batch) => batch,
      onProgress: (done) => { progress.push(done) },
    })
    expect(progress).toEqual([1, 2, 3])
  })
})

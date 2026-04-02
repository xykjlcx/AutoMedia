import { v4 as uuid } from 'uuid'
import { db } from './db/index'
import { rawItems, digestItems, digestRuns } from './db/schema'
import { eq } from 'drizzle-orm'
import { getPublicSources, getPrivateSources } from './sources'
import { rssCollector } from './collectors/rss'
import { browserCollector } from './collectors/browser'
import { scoreItems, filterTopItems } from './ai/scoring'
import { clusterItems } from './ai/clustering'
import { summarizeItems } from './ai/summarize'
import type { CollectedItem } from './collectors/types'

export async function runDigestPipeline(date: string): Promise<string> {
  const runId = uuid()
  const now = new Date().toISOString()

  // 创建执行记录
  await db.insert(digestRuns).values({
    id: runId,
    digestDate: date,
    status: 'collecting',
    progress: { step: 'collecting', detail: '开始采集...' },
    startedAt: now,
  })

  const errors: Record<string, string> = {}
  const allItems: CollectedItem[] = []

  try {
    // ── Stage 0: 采集 ──
    const publicSources = getPublicSources()
    for (const source of publicSources) {
      try {
        await updateProgress(runId, 'collecting', `采集 ${source.name}...`)
        const items = await rssCollector.collect(source.id, { rssPath: source.rssPath || '' })
        allItems.push(...items)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors[source.id] = msg
        console.error(`[pipeline] ${source.name} 采集失败:`, msg)
      }
    }

    const privateSources = getPrivateSources()
    for (const source of privateSources) {
      try {
        await updateProgress(runId, 'collecting', `采集 ${source.name}...`)
        const items = await browserCollector.collect(source.id, { targetUrl: source.targetUrl || '' })
        allItems.push(...items)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors[source.id] = msg
      }
    }

    // 写入原始数据
    if (allItems.length > 0) {
      const rawRecords = allItems.map(item => ({
        id: uuid(),
        source: item.source,
        sourceType: item.sourceType,
        title: item.title,
        content: item.content,
        url: item.url,
        author: item.author,
        digestDate: date,
        collectedAt: new Date().toISOString(),
      }))
      await db.insert(rawItems).values(rawRecords)
    }

    await db.update(digestRuns).set({
      rawCount: allItems.length,
      progress: { step: 'processing', detail: `采集完成，共 ${allItems.length} 条，开始 AI 处理...` },
      status: 'processing',
    }).where(eq(digestRuns.id, runId))

    // ── Stage 1: AI 评分筛选 ──
    await updateProgress(runId, 'processing', 'AI 评分筛选中...')
    const scored = await scoreItems(allItems)
    const filtered = filterTopItems(scored)

    // ── Stage 2: 跨源去重 ──
    await updateProgress(runId, 'processing', '跨源去重中...')
    const clustered = await clusterItems(filtered)

    // ── Stage 3: AI 摘要生成 ──
    await updateProgress(runId, 'processing', 'AI 摘要生成中...')
    const summarized = await summarizeItems(clustered)

    // 写入精选数据
    if (summarized.length > 0) {
      // 先清理当天旧数据（支持重新生成）
      await db.delete(digestItems).where(eq(digestItems.digestDate, date))

      const digestRecords = summarized.map(item => ({
        id: uuid(),
        digestDate: date,
        source: item.source,
        title: item.title,
        url: item.url,
        author: item.author,
        aiScore: item.aiScore,
        oneLiner: item.oneLiner,
        summary: item.summary,
        clusterId: item.clusterId,
        clusterSources: item.clusterSources,
        createdAt: new Date().toISOString(),
      }))
      await db.insert(digestItems).values(digestRecords)
    }

    // 完成
    await db.update(digestRuns).set({
      status: 'completed',
      filteredCount: summarized.length,
      completedAt: new Date().toISOString(),
      progress: { step: 'completed', detail: `完成！共 ${summarized.length} 条精选` },
      errors: Object.keys(errors).length > 0 ? errors : null,
    }).where(eq(digestRuns.id, runId))

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.update(digestRuns).set({
      status: 'failed',
      completedAt: new Date().toISOString(),
      progress: { step: 'failed', detail: msg },
      errors: { ...errors, pipeline: msg },
    }).where(eq(digestRuns.id, runId))
  }

  return runId
}

async function updateProgress(runId: string, status: string, detail: string) {
  await db.update(digestRuns).set({
    progress: { step: status, detail },
  }).where(eq(digestRuns.id, runId))
}

import { v4 as uuid } from 'uuid'
import { db } from './db/index'
import { rawItems, digestItems, digestRuns, favorites } from './db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { getPublicSources, getPrivateSources } from './sources'
import { rssCollector } from './collectors/rss'
import { browserCollector } from './collectors/browser'
import { scoreItems, filterTopItems } from './ai/scoring'
import { clusterItems } from './ai/clustering'
import { summarizeItems } from './ai/summarize'
import type { CollectedItem } from './collectors/types'

// 并发保护：检查当天是否有正在运行的 pipeline
export async function isDigestRunning(date: string): Promise<boolean> {
  const runs = await db.select().from(digestRuns)
    .where(and(
      eq(digestRuns.digestDate, date),
      eq(digestRuns.status, 'collecting'),
    )).limit(1)
  if (runs.length > 0) return true

  const runs2 = await db.select().from(digestRuns)
    .where(and(
      eq(digestRuns.digestDate, date),
      eq(digestRuns.status, 'processing'),
    )).limit(1)
  return runs2.length > 0
}

export async function runDigestPipeline(date: string): Promise<string> {
  // 并发检查
  if (await isDigestRunning(date)) {
    throw new Error('当天日报正在生成中，请勿重复触发')
  }

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
        const items = await rssCollector.collect(source.id, {
          rssPath: source.rssPath || '',
          rssUrl: source.rssUrl || ''
        })
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

    // 写入原始数据（按 URL 去重，避免重复采集）
    if (allItems.length > 0) {
      // 查询当天已有的 URL
      const existingRaw = await db.select({ url: rawItems.url })
        .from(rawItems).where(eq(rawItems.digestDate, date))
      const existingUrls = new Set(existingRaw.map(r => r.url))

      const newItems = allItems.filter(item => !existingUrls.has(item.url))
      if (newItems.length > 0) {
        const rawRecords = newItems.map(item => ({
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
      // 必须先删收藏（外键约束），再删 digest_items
      const oldDigestIds = (await db.select({ id: digestItems.id })
        .from(digestItems).where(eq(digestItems.digestDate, date)))
        .map(r => r.id)
      if (oldDigestIds.length > 0) {
        await db.delete(favorites).where(inArray(favorites.digestItemId, oldDigestIds))
      }
      // 清理 FTS 中对应日期的旧数据（在删除 digestItems 之前）
      db.run(sql`DELETE FROM digest_fts WHERE digest_date = ${date}`)
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

      // 同步写入 FTS 索引
      for (const record of digestRecords) {
        db.run(sql`INSERT INTO digest_fts (digest_item_id, title, one_liner, summary, source, digest_date)
          VALUES (${record.id}, ${record.title}, ${record.oneLiner}, ${record.summary}, ${record.source}, ${record.digestDate})`)
      }
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

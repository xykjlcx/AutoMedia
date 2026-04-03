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
import { sendDigestNotification } from './notify'

// ── 进度结构定义 ──

export interface SourceProgress {
  status: 'pending' | 'running' | 'done' | 'error'
  name: string
  icon: string
  count?: number
  duration?: number
  error?: string
}

export interface PipelineProgress {
  phase: 'collecting' | 'scoring' | 'clustering' | 'summarizing' | 'completed' | 'failed'
  // 采集阶段每个源的状态
  sources?: Record<string, SourceProgress>
  // AI 阶段的统计
  scoring?: { total: number; done: number; filtered: number }
  clustering?: { total: number; done: number }
  summarizing?: { total: number; done: number }
  detail?: string
}

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

  // 初始化所有源为 pending
  const publicSources = getPublicSources()
  const privateSources = getPrivateSources()
  const allSources = [...publicSources, ...privateSources]
  const sourcesProgress: Record<string, SourceProgress> = {}
  for (const s of allSources) {
    sourcesProgress[s.id] = { status: 'pending', name: s.name, icon: s.icon }
  }

  const progress: PipelineProgress = {
    phase: 'collecting',
    sources: sourcesProgress,
    detail: '开始采集...',
  }

  // 创建执行记录
  await db.insert(digestRuns).values({
    id: runId,
    digestDate: date,
    status: 'collecting',
    progress,
    startedAt: now,
  })

  const errors: Record<string, string> = {}
  const allItems: CollectedItem[] = []

  try {
    // ── Stage 0: 采集 ──
    // 辅助函数：更新源状态时保留 name/icon
    const updateSource = (id: string, patch: Partial<SourceProgress>) => {
      progress.sources![id] = { ...progress.sources![id], ...patch }
    }

    for (const source of publicSources) {
      try {
        updateSource(source.id, { status: 'running' })
        progress.detail = `采集 ${source.name}...`
        await saveProgress(runId, progress)

        const startTime = Date.now()
        const items = await rssCollector.collect(source.id, {
          rssPath: source.rssPath || '',
          rssUrl: source.rssUrl || ''
        })
        const duration = (Date.now() - startTime) / 1000

        allItems.push(...items)
        updateSource(source.id, { status: 'done', count: items.length, duration })
        await saveProgress(runId, progress)
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        errors[source.id] = msg
        updateSource(source.id, { status: 'error', error: msg })
        await saveProgress(runId, progress)
        console.error(`[pipeline] ${source.name} 采集失败:`, err)
      }
    }

    for (const source of privateSources) {
      try {
        updateSource(source.id, { status: 'running' })
        progress.detail = `采集 ${source.name}...`
        await saveProgress(runId, progress)

        const startTime = Date.now()
        const items = await browserCollector.collect(source.id, { targetUrl: source.targetUrl || '' })
        const duration = (Date.now() - startTime) / 1000

        allItems.push(...items)
        updateSource(source.id, { status: 'done', count: items.length, duration })
        await saveProgress(runId, progress)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors[source.id] = msg
        updateSource(source.id, { status: 'error', error: msg })
        await saveProgress(runId, progress)
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

    // ── Stage 1: AI 评分筛选 ──
    progress.phase = 'scoring'
    progress.scoring = { total: allItems.length, done: 0, filtered: 0 }
    progress.detail = 'AI 评分筛选中...'
    await db.update(digestRuns).set({
      rawCount: allItems.length,
      progress,
      status: 'processing',
    }).where(eq(digestRuns.id, runId))

    const scored = await scoreItems(allItems, (done) => {
      progress.scoring!.done = done
      progress.detail = `已评分 ${done}/${allItems.length} 条`
      saveProgress(runId, progress)
    })
    const filtered = filterTopItems(scored)
    progress.scoring!.done = allItems.length
    progress.scoring!.filtered = filtered.length
    progress.detail = `评分完成，筛选出 ${filtered.length} 条`
    await saveProgress(runId, progress)

    // ── Stage 2: 跨源去重 ──
    progress.phase = 'clustering'
    progress.clustering = { total: filtered.length, done: 0 }
    progress.detail = '跨源去重中...'
    await saveProgress(runId, progress)

    const clustered = await clusterItems(filtered)
    progress.clustering!.done = filtered.length
    progress.detail = `去重完成，剩余 ${clustered.length} 条`
    await saveProgress(runId, progress)

    // ── Stage 3: AI 摘要生成 ──
    progress.phase = 'summarizing'
    progress.summarizing = { total: clustered.length, done: 0 }
    progress.detail = 'AI 摘要生成中...'
    await saveProgress(runId, progress)

    const summarized = await summarizeItems(clustered, (done) => {
      progress.summarizing!.done = done
      progress.detail = `已生成 ${done}/${clustered.length} 条摘要`
      saveProgress(runId, progress)
    })
    progress.summarizing!.done = clustered.length
    await saveProgress(runId, progress)

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
    const completedProgress: PipelineProgress = {
      phase: 'completed',
      sources: progress.sources,
      scoring: progress.scoring,
      clustering: progress.clustering,
      summarizing: progress.summarizing,
      detail: `完成！共 ${summarized.length} 条精选`,
    }
    await db.update(digestRuns).set({
      status: 'completed',
      filteredCount: summarized.length,
      completedAt: new Date().toISOString(),
      progress: completedProgress,
      errors: Object.keys(errors).length > 0 ? errors : null,
    }).where(eq(digestRuns.id, runId))

    // 发送通知
    sendDigestNotification(date, summarized.length).catch(err =>
      console.error('[pipeline] 通知发送失败:', err)
    )

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const failedProgress: PipelineProgress = {
      phase: 'failed',
      sources: progress.sources,
      scoring: progress.scoring,
      clustering: progress.clustering,
      summarizing: progress.summarizing,
      detail: msg,
    }
    await db.update(digestRuns).set({
      status: 'failed',
      completedAt: new Date().toISOString(),
      progress: failedProgress,
      errors: { ...errors, pipeline: msg },
    }).where(eq(digestRuns.id, runId))
  }

  return runId
}

async function saveProgress(runId: string, progress: PipelineProgress) {
  await db.update(digestRuns).set({
    progress: { ...progress },
  }).where(eq(digestRuns.id, runId))
}

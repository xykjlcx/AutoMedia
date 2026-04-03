import { v4 as uuid } from 'uuid'
import { db } from './db/index'
import { rawItems, digestRuns } from './db/schema'
import { eq, and } from 'drizzle-orm'
import { getPublicSources } from './sources'
import { rssCollector } from './collectors/rss'
import { scoreItems } from './ai/scoring'
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
  const allSources = publicSources
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

    const scored = await scoreItems(allItems, async (done) => {
      progress.scoring!.done = done
      progress.detail = `已评分 ${done}/${allItems.length} 条`
      await saveProgress(runId, progress)
    })
    // 不过滤，所有评分过的内容都保留，前端用 Tab 分类展示
    const recommendedCount = scored.filter(s => s.aiScore >= 5).length
    progress.scoring!.done = allItems.length
    progress.scoring!.filtered = recommendedCount
    progress.detail = `评分完成，${recommendedCount} 条推荐`
    await saveProgress(runId, progress)

    // ── Stage 2: 跨源去重 ──
    progress.phase = 'clustering'
    progress.clustering = { total: scored.length, done: 0 }
    progress.detail = '跨源去重中...'
    await saveProgress(runId, progress)

    const clustered = await clusterItems(scored)
    progress.clustering!.done = scored.length
    progress.detail = `去重完成，剩余 ${clustered.length} 条`
    await saveProgress(runId, progress)

    // ── Stage 3: AI 摘要生成 ──
    progress.phase = 'summarizing'
    progress.summarizing = { total: clustered.length, done: 0 }
    progress.detail = 'AI 摘要生成中...'
    await saveProgress(runId, progress)

    const summarized = await summarizeItems(clustered, async (done) => {
      progress.summarizing!.done = done
      progress.detail = `已生成 ${done}/${clustered.length} 条摘要`
      await saveProgress(runId, progress)
    })
    progress.summarizing!.done = clustered.length
    await saveProgress(runId, progress)

    // 写入精选数据（事务保证原子性）
    if (summarized.length > 0) {
      const writeDigest = db.$client.transaction(() => {
        // 先清理当天旧数据
        const oldDigestIds = db.$client
          .prepare('SELECT id FROM digest_items WHERE digest_date = ?')
          .all(date) as { id: string }[]

        if (oldDigestIds.length > 0) {
          const idPlaceholders = oldDigestIds.map(() => '?').join(',')
          db.$client
            .prepare(`DELETE FROM favorites WHERE digest_item_id IN (${idPlaceholders})`)
            .run(...oldDigestIds.map(r => r.id))
        }

        db.$client.prepare('DELETE FROM digest_fts WHERE digest_date = ?').run(date)
        db.$client.prepare('DELETE FROM digest_items WHERE digest_date = ?').run(date)

        // 插入新数据
        const insertDigest = db.$client.prepare(`
          INSERT INTO digest_items (id, digest_date, source, title, url, author, ai_score, one_liner, summary, cluster_id, cluster_sources, created_at, is_read)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `)
        const insertFts = db.$client.prepare(`
          INSERT INTO digest_fts (digest_item_id, title, one_liner, summary, source, digest_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `)

        for (const item of summarized) {
          const id = uuid()
          const now = new Date().toISOString()
          insertDigest.run(
            id, date, item.source, item.title, item.url, item.author || '',
            item.aiScore, item.oneLiner, item.summary,
            item.clusterId || null, JSON.stringify(item.clusterSources || []), now
          )
          insertFts.run(id, item.title, item.oneLiner, item.summary, item.source, date)
        }
      })

      writeDigest()
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

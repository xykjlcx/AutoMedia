import { v4 as uuid } from 'uuid'
import { db } from '../db/index'
import { rawItems, digestRuns } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getPublicSources, getEnabledSources } from '@/lib/sources'
import { rssCollector } from './collectors/rss'
import { scoreItems } from './scoring'
import { clusterItems } from './clustering'
import { summarizeItems } from './summarize'
import { analyzeTrends } from './trends'
import type { CollectedItem } from './collectors/types'
import { sendDigestNotification } from '@/lib/notify'
import { shouldUpdateProfile, updatePreferenceProfile } from './preference'
import { pipelineEvents } from '@/lib/pipeline-events'

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
  // AI 阶段的统计（含每阶段耗时）
  scoring?: { total: number; done: number; filtered: number; failed?: number; duration?: number }
  clustering?: { total: number; done: number; duration?: number }
  summarizing?: { total: number; done: number; failed?: number; duration?: number }
  // 阶段耗时汇总（秒）
  timing?: {
    collecting?: number
    scoring?: number
    clustering?: number
    summarizing?: number
    trends?: number
    total?: number
  }
  detail?: string
}

// 并发保护：检查当天是否有正在运行的 pipeline
export async function isDigestRunning(date: string): Promise<boolean> {
  const runs = await db.select().from(digestRuns)
    .where(and(
      eq(digestRuns.digestDate, date),
      inArray(digestRuns.status, ['collecting', 'processing']),
    )).limit(1)
  return runs.length > 0
}

export async function runDigestPipeline(date: string): Promise<string> {
  // 并发检查
  if (await isDigestRunning(date)) {
    throw new Error('当天日报正在生成中，请勿重复触发')
  }

  const runId = uuid()
  const now = new Date().toISOString()

  // 初始化所有源为 pending（含私域源，标记为待实现）
  const publicSources = getPublicSources()
  const allEnabledSources = getEnabledSources()
  const privateSources = allEnabledSources.filter(s => s.type === 'private')
  const sourcesProgress: Record<string, SourceProgress> = {}
  for (const s of allEnabledSources) {
    sourcesProgress[s.id] = { status: 'pending', name: s.name, icon: s.icon }
  }

  const progress: PipelineProgress = {
    phase: 'collecting',
    sources: sourcesProgress,
    timing: {},
    detail: '开始采集...',
  }
  const pipelineStartTime = Date.now()

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

    // 所有源并行采集
    const collectStartTime = Date.now()
    for (const source of publicSources) {
      updateSource(source.id, { status: 'running' })
    }
    progress.detail = `并行采集 ${publicSources.length} 个源...`
    await saveProgress(runId, progress, date)

    const collectResults = await Promise.allSettled(
      publicSources.map(async (source) => {
        const startTime = Date.now()
        const items = await rssCollector.collect(source.id, {
          rssPath: source.rssPath || '',
          rssUrl: source.rssUrl || ''
        })
        const duration = (Date.now() - startTime) / 1000
        return { sourceId: source.id, items, duration }
      })
    )

    for (let i = 0; i < collectResults.length; i++) {
      const result = collectResults[i]
      const source = publicSources[i]
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.items)
        updateSource(source.id, { status: 'done', count: result.value.items.length, duration: result.value.duration })
      } else {
        const msg = result.reason instanceof Error ? `${result.reason.name}: ${result.reason.message}` : String(result.reason)
        errors[source.id] = msg
        updateSource(source.id, { status: 'error', error: msg })
        console.error(`[pipeline] ${source.name} 采集失败:`, result.reason)
      }
    }
    await saveProgress(runId, progress, date)

    progress.timing!.collecting = Math.round((Date.now() - collectStartTime) / 1000)

    // 私域源标记为待实现
    for (const source of privateSources) {
      updateSource(source.id, { status: 'error', error: '私域采集待实现' })
    }
    if (privateSources.length > 0) {
      await saveProgress(runId, progress, date)
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

    // ── 增量过滤：只处理当天尚未入库的条目 ──
    const existingDigestUrls = new Set(
      (db.$client
        .prepare('SELECT url FROM digest_items WHERE digest_date = ?')
        .all(date) as { url: string }[])
        .map(r => r.url)
    )
    const newItems = allItems.filter(item => !existingDigestUrls.has(item.url))
    const skippedCount = allItems.length - newItems.length

    // 没有新内容则跳过 AI 处理
    if (newItems.length === 0) {
      const totalDigest = existingDigestUrls.size
      progress.timing!.total = Math.round((Date.now() - pipelineStartTime) / 1000)
      const completedProgress: PipelineProgress = {
        phase: 'completed',
        sources: progress.sources,
        timing: progress.timing,
        detail: `无新增内容（已有 ${totalDigest} 条），跳过 AI 处理`,
      }
      await db.update(digestRuns).set({
        rawCount: allItems.length,
        status: 'completed',
        filteredCount: totalDigest,
        completedAt: new Date().toISOString(),
        progress: completedProgress,
        errors: Object.keys(errors).length > 0 ? errors : null,
      }).where(eq(digestRuns.id, runId))
      pipelineEvents.emitProgress({ runId, date, progress: completedProgress })
      sendDigestNotification(date, totalDigest).catch(err =>
        console.error('[pipeline] 通知发送失败:', err)
      )
      return runId
    }

    // ── Stage 1: AI 评分筛选（仅新增条目）──
    const scoreStartTime = Date.now()
    progress.phase = 'scoring'
    progress.scoring = { total: newItems.length, done: 0, filtered: 0 }
    progress.detail = `AI 评分中（${skippedCount} 条已有，${newItems.length} 条新增）...`
    await db.update(digestRuns).set({
      rawCount: allItems.length,
      progress,
      status: 'processing',
    }).where(eq(digestRuns.id, runId))
    pipelineEvents.emitProgress({ runId, date, progress })

    const scoreResult = await scoreItems(newItems, async (done) => {
      progress.scoring!.done = done
      progress.detail = `已评分 ${done}/${newItems.length} 条`
      await saveProgress(runId, progress, date)
    })
    const scored = scoreResult.items
    const recommendedCount = scored.filter(s => s.aiScore >= 5).length
    progress.scoring!.done = newItems.length
    progress.scoring!.filtered = recommendedCount
    progress.scoring!.failed = scoreResult.failedCount
    const failNote = scoreResult.failedCount > 0 ? `（${scoreResult.failedCount} 条评分失败）` : ''
    progress.scoring!.duration = Math.round((Date.now() - scoreStartTime) / 1000)
    progress.timing!.scoring = progress.scoring!.duration
    progress.detail = `评分完成，${recommendedCount} 条推荐${failNote}`
    await saveProgress(runId, progress, date)

    // ── Stage 2: 跨源去重（仅新增条目之间 + 与已有条目的去重）──
    const clusterStartTime = Date.now()
    progress.phase = 'clustering'
    progress.clustering = { total: scored.length, done: 0 }
    progress.detail = '跨源去重中...'
    await saveProgress(runId, progress, date)

    const clustered = await clusterItems(scored)
    progress.clustering!.done = scored.length
    progress.clustering!.duration = Math.round((Date.now() - clusterStartTime) / 1000)
    progress.timing!.clustering = progress.clustering!.duration
    progress.detail = `去重完成，剩余 ${clustered.length} 条新增`
    await saveProgress(runId, progress, date)

    // ── Stage 3: AI 摘要生成（仅新增条目）──
    const summarizeStartTime = Date.now()
    progress.phase = 'summarizing'
    progress.summarizing = { total: clustered.length, done: 0 }
    progress.detail = 'AI 摘要生成中...'
    await saveProgress(runId, progress, date)

    const summarizeResult = await summarizeItems(clustered, async (done) => {
      progress.summarizing!.done = done
      progress.detail = `已生成 ${done}/${clustered.length} 条摘要`
      await saveProgress(runId, progress, date)
    })
    const summarized = summarizeResult.items
    progress.summarizing!.done = clustered.length
    progress.summarizing!.failed = summarizeResult.failedCount
    progress.summarizing!.duration = Math.round((Date.now() - summarizeStartTime) / 1000)
    progress.timing!.summarizing = progress.summarizing!.duration
    await saveProgress(runId, progress, date)

    // ── Stage 3.5: 趋势分析 ──
    const trendsStartTime = Date.now()
    progress.detail = '趋势分析中...'
    await saveProgress(runId, progress, date)

    const trendMap = await analyzeTrends(
      date,
      summarized.map(item => ({ url: item.url, title: item.title, source: item.source }))
    )

    progress.timing!.trends = Math.round((Date.now() - trendsStartTime) / 1000)

    // 增量写入新条目（不删除旧数据，保留收藏和已读状态）
    if (summarized.length > 0) {
      const writeNewDigest = db.$client.transaction(() => {
        const insertDigest = db.$client.prepare(`
          INSERT INTO digest_items (id, digest_date, source, title, url, author, ai_score, one_liner, summary, cluster_id, cluster_sources, created_at, is_read, trend_tag)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
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
            item.clusterId || null, JSON.stringify(item.clusterSources || []), now,
            trendMap.get(item.url) || null
          )
          insertFts.run(id, item.title, item.oneLiner, item.summary, item.source, date)
        }
      })

      writeNewDigest()
    }

    // 统计当天总数
    const totalDigest = (db.$client
      .prepare('SELECT COUNT(*) as cnt FROM digest_items WHERE digest_date = ?')
      .get(date) as { cnt: number }).cnt

    // 完成
    progress.timing!.total = Math.round((Date.now() - pipelineStartTime) / 1000)
    const completedProgress: PipelineProgress = {
      phase: 'completed',
      sources: progress.sources,
      scoring: progress.scoring,
      clustering: progress.clustering,
      summarizing: progress.summarizing,
      timing: progress.timing,
      detail: `完成！新增 ${summarized.length} 条，共 ${totalDigest} 条`,
    }
    await db.update(digestRuns).set({
      status: 'completed',
      filteredCount: totalDigest,
      completedAt: new Date().toISOString(),
      progress: completedProgress,
      errors: Object.keys(errors).length > 0 ? errors : null,
    }).where(eq(digestRuns.id, runId))
    pipelineEvents.emitProgress({ runId, date, progress: completedProgress })

    // 异步更新偏好画像（不阻塞完成流程）
    if (shouldUpdateProfile()) {
      updatePreferenceProfile().catch(err =>
        console.error('[pipeline] 偏好画像更新失败:', err)
      )
    }

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
    pipelineEvents.emitProgress({ runId, date, progress: failedProgress })
  }

  return runId
}

async function saveProgress(runId: string, progress: PipelineProgress, date?: string) {
  await db.update(digestRuns).set({
    progress: { ...progress },
  }).where(eq(digestRuns.id, runId))
  // 同步广播到 SSE
  if (date) {
    pipelineEvents.emitProgress({ runId, date, progress: { ...progress } })
  }
}

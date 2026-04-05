// AI 推荐引擎 — 根据用户偏好匹配 RSS 源

import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from '@/lib/ai/client'
import { getPreferenceProfile } from '@/lib/digest/preference'
import { getAllSources } from '@/lib/sources'
import { db } from '@/lib/db/index'
import { sourceSuggestions, sourceConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { RSS_CATALOG, CATEGORY_LABELS, type CatalogEntry } from './catalog'

export interface Suggestion {
  id: string
  name: string
  description: string
  rssUrl: string
  category: string
  reason: string
  status: string
  createdAt: string
}

// 获取缓存的推荐列表（仅 pending 状态）
export function getCachedSuggestions(): Suggestion[] {
  try {
    return db.select().from(sourceSuggestions)
      .where(eq(sourceSuggestions.status, 'pending'))
      .all()
  } catch {
    return []
  }
}

// 获取所有推荐记录（包括已添加/已忽略）
export function getAllSuggestions(): Suggestion[] {
  try {
    return db.select().from(sourceSuggestions).all()
  } catch {
    return []
  }
}

// 过滤掉用户已有的源
function getAvailableSources(): CatalogEntry[] {
  const existingSources = getAllSources()
  const existingUrls = new Set(
    existingSources.map(s => s.rssUrl).filter(Boolean)
  )
  const existingPaths = new Set(
    existingSources.map(s => s.rssPath).filter(Boolean)
  )

  // 也排除已推荐过的（不管状态）
  const allSuggested = getAllSuggestions()
  const suggestedUrls = new Set(allSuggested.map(s => s.rssUrl))

  return RSS_CATALOG.filter(entry => {
    // RSSHub 路径格式
    if (entry.rssUrl.startsWith('/')) {
      return !existingPaths.has(entry.rssUrl) && !suggestedUrls.has(entry.rssUrl)
    }
    // 完整 URL
    return !existingUrls.has(entry.rssUrl) && !suggestedUrls.has(entry.rssUrl)
  })
}

// AI 推荐排序 schema
const recommendationSchema = z.object({
  recommendations: z.array(z.object({
    index: z.number().describe('目录中的索引位置'),
    reason: z.string().describe('推荐理由，1-2 句话，说明为什么适合用户'),
  })).describe('按推荐优先级排序的源列表，最多 8 条'),
})

// 仅计算推荐（不写库），供原子性替换使用
async function computeRecommendations(): Promise<Suggestion[]> {
  const available = getAvailableSources()
  if (available.length === 0) return []

  const profile = getPreferenceProfile()

  // 构建目录描述
  const catalogText = available.map((entry, idx) => {
    const categoryLabel = CATEGORY_LABELS[entry.category] || entry.category
    return `[${idx}] ${entry.name} (${categoryLabel}) — ${entry.description} [标签: ${entry.tags.join(', ')}]`
  }).join('\n')

  // 有偏好画像时用 AI 排序，没有时选热门通用源
  let recommendations: Array<{ index: number; reason: string }>

  if (profile) {
    const result = await generateObject({
      model: getModels().fast,
      schema: recommendationSchema,
      prompt: `你是一个 RSS 源推荐助手。根据用户的阅读偏好，从以下源目录中推荐最适合的 5-8 个源。

用户偏好画像：
${profile}

可选 RSS 源目录：
${catalogText}

推荐原则：
1. 优先推荐与用户兴趣高度相关的源
2. 适当推荐 1-2 个可能拓展视野的源（跨领域发现）
3. 中英文源都要覆盖
4. 推荐理由要具体，说明为什么适合这个用户

返回推荐列表，按优先级排序。`,
    })
    recommendations = result.object.recommendations
  } else {
    // 没有偏好画像，推荐各分类的热门源
    const picks: Array<{ index: number; reason: string }> = []
    const categories = ['ai', 'tech', 'startup', 'general', 'ecommerce']
    for (const cat of categories) {
      const catEntries = available
        .map((e, idx) => ({ entry: e, idx }))
        .filter(({ entry }) => entry.category === cat)
      if (catEntries.length > 0) {
        const pick = catEntries[0]
        picks.push({
          index: pick.idx,
          reason: `${CATEGORY_LABELS[cat]}领域的优质源，推荐订阅以获取该领域资讯`,
        })
      }
      if (picks.length >= 8) break
    }
    // 如果不够 8 个，继续从剩余分类补充
    for (const cat of categories) {
      const catEntries = available
        .map((e, idx) => ({ entry: e, idx }))
        .filter(({ entry }) => entry.category === cat)
      for (const pick of catEntries.slice(1)) {
        if (picks.length >= 8) break
        if (!picks.some(p => p.index === pick.idx)) {
          picks.push({
            index: pick.idx,
            reason: `${CATEGORY_LABELS[cat]}领域的热门源`,
          })
        }
      }
      if (picks.length >= 8) break
    }
    recommendations = picks
  }

  // 组装推荐对象（不落库）
  const now = new Date().toISOString()
  const suggestions: Suggestion[] = []

  for (const rec of recommendations) {
    if (rec.index < 0 || rec.index >= available.length) continue
    const entry = available[rec.index]
    const id = `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    suggestions.push({
      id,
      name: entry.name,
      description: entry.description,
      rssUrl: entry.rssUrl,
      category: entry.category,
      reason: rec.reason,
      status: 'pending',
      createdAt: now,
    })
  }

  return suggestions
}

// 生成 AI 推荐并写库（供首次加载使用：库里没 pending 时调用）
export async function generateRecommendations(): Promise<Suggestion[]> {
  const suggestions = await computeRecommendations()
  if (suggestions.length === 0) return []

  db.$client.transaction(() => {
    for (const suggestion of suggestions) {
      db.insert(sourceSuggestions).values(suggestion).run()
    }
  })()

  return suggestions
}

// 原子性替换：先算出新推荐，成功后再在事务里把旧 pending 标 dismissed 并插入新的
// AI 调用失败时旧推荐保持不变，避免用户看到空列表
export async function refreshRecommendations(): Promise<Suggestion[]> {
  const fresh = await computeRecommendations()

  // 即使生成为空也要进入替换流程，让旧 pending 被清理，与旧行为保持一致
  db.$client.transaction(() => {
    db.update(sourceSuggestions)
      .set({ status: 'dismissed' })
      .where(eq(sourceSuggestions.status, 'pending'))
      .run()

    for (const suggestion of fresh) {
      db.insert(sourceSuggestions).values(suggestion).run()
    }
  })()

  return fresh
}

// 将推荐源添加到用户源列表
export function addSuggestionToSources(suggestionId: string): { success: boolean; error?: string } {
  const rows = db.select().from(sourceSuggestions)
    .where(eq(sourceSuggestions.id, suggestionId))
    .all()

  if (rows.length === 0) return { success: false, error: '推荐不存在' }
  const suggestion = rows[0]

  // 创建源配置
  const maxSort = db.select().from(sourceConfigs).all().length
  const sourceId = `custom-${Date.now()}`

  // 判断是 RSSHub 路径还是完整 URL
  const isRssHub = suggestion.rssUrl.startsWith('/')

  db.insert(sourceConfigs).values({
    id: sourceId,
    name: suggestion.name,
    icon: '📰',
    type: 'custom-rss',
    rssPath: isRssHub ? suggestion.rssUrl : '',
    rssUrl: isRssHub ? '' : suggestion.rssUrl,
    targetUrl: '',
    enabled: true,
    maxItems: 5,
    sortOrder: maxSort,
    createdAt: new Date().toISOString(),
  }).run()

  // 更新推荐状态
  db.update(sourceSuggestions)
    .set({ status: 'added' })
    .where(eq(sourceSuggestions.id, suggestionId))
    .run()

  return { success: true }
}

// 忽略推荐
export function dismissSuggestion(suggestionId: string): { success: boolean; error?: string } {
  const rows = db.select().from(sourceSuggestions)
    .where(eq(sourceSuggestions.id, suggestionId))
    .all()

  if (rows.length === 0) return { success: false, error: '推荐不存在' }

  db.update(sourceSuggestions)
    .set({ status: 'dismissed' })
    .where(eq(sourceSuggestions.id, suggestionId))
    .run()

  return { success: true }
}


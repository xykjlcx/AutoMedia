import { generateText } from 'ai'
import { getModels } from '@/lib/ai/client'
import { db } from '../db/index'
import { userProfile } from '../db/schema'
import { eq } from 'drizzle-orm'

const MIN_RATINGS_FOR_PROFILE = 10
const PROFILE_REFRESH_INTERVAL = 20

// 获取当前偏好画像
export function getPreferenceProfile(): string | null {
  try {
    const rows = db.select().from(userProfile).where(eq(userProfile.id, 'default')).all()
    return rows[0]?.profile || null
  } catch {
    return null
  }
}

// 检查是否需要更新画像
export function shouldUpdateProfile(): boolean {
  try {
    const totalRatings = (db.$client
      .prepare('SELECT COUNT(*) as cnt FROM user_ratings')
      .get() as { cnt: number }).cnt

    const profile = db.select().from(userProfile).where(eq(userProfile.id, 'default')).all()

    if (totalRatings < MIN_RATINGS_FOR_PROFILE) return false
    if (profile.length === 0) return true
    return totalRatings - (profile[0].ratingCount || 0) >= PROFILE_REFRESH_INTERVAL
  } catch {
    return false
  }
}

// 用 AI 从评价历史生成偏好画像
export async function updatePreferenceProfile(): Promise<string> {
  const ratings = db.$client.prepare(`
    SELECT ur.rating, di.title, di.source, di.one_liner
    FROM user_ratings ur
    JOIN digest_items di ON ur.digest_item_id = di.id
    ORDER BY ur.created_at DESC
    LIMIT 100
  `).all() as Array<{ rating: string; title: string; source: string; one_liner: string }>

  const liked = ratings.filter(r => r.rating === 'like')
    .map(r => `- [${r.source}] ${r.title}`)
    .join('\n')
  const disliked = ratings.filter(r => r.rating === 'dislike')
    .map(r => `- [${r.source}] ${r.title}`)
    .join('\n')

  const { text: profile } = await generateText({
    model: getModels().fast,
    prompt: `根据用户的文章评价历史，总结用户的内容偏好画像。

用户喜欢的文章：
${liked || '（暂无）'}

用户不喜欢的文章：
${disliked || '（暂无）'}

请用 2-3 句话总结用户的偏好特征，包括：
1. 偏好的话题/领域
2. 不感兴趣的内容类型
3. 偏好的内容风格（实战/理论/新闻/观点等）

只返回偏好描述，不要有其他文字。`,
  })

  const totalRatings = (db.$client
    .prepare('SELECT COUNT(*) as cnt FROM user_ratings')
    .get() as { cnt: number }).cnt

  const now = new Date().toISOString()
  const existing = db.select().from(userProfile).where(eq(userProfile.id, 'default')).all()

  if (existing.length === 0) {
    await db.insert(userProfile).values({
      id: 'default',
      profile,
      ratingCount: totalRatings,
      updatedAt: now,
    })
  } else {
    await db.update(userProfile).set({
      profile,
      ratingCount: totalRatings,
      updatedAt: now,
    }).where(eq(userProfile.id, 'default'))
  }

  console.log('[preference] 偏好画像已更新:', profile)
  return profile
}

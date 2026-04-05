import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from '@/lib/ai/client'
import { db } from '@/lib/db/index'
import { styleProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// 风格学习阈值：样本数不足时不生成画像，避免单条草稿的噪声被当成风格
const MIN_SAMPLES_FOR_PROFILE = 3
// 画像刷新间隔：每累计 N 条新样本才重跑一次，省 token
const PROFILE_REFRESH_INTERVAL = 5

const styleSchema = z.object({
  profile: z
    .string()
    .describe('用户的写作风格画像，200-300 字，包括语气、句式、用词、常见修改模式'),
})

// 读取指定平台的风格画像（无则返回 null）
export function getStyleProfile(platform: string): string | null {
  try {
    const rows = db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.id, platform))
      .all()
    return rows[0]?.profile || null
  } catch {
    return null
  }
}

// 判断是否需要刷新画像：样本数达到阈值 && 距上次更新积累了足够新样本
export function shouldUpdateStyleProfile(platform: string): boolean {
  try {
    // 符合条件的草稿：有 AI 原稿、用户编辑过、内容有足够长度
    const eligibleCount = (
      db.$client
        .prepare(
          `
        SELECT COUNT(*) as cnt FROM drafts
        WHERE platform = ?
          AND ai_original != ''
          AND content != ai_original
          AND length(content) > 50
      `
        )
        .get(platform) as { cnt: number }
    ).cnt

    if (eligibleCount < MIN_SAMPLES_FOR_PROFILE) return false

    const profile = db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.id, platform))
      .all()
    if (profile.length === 0) return true

    return eligibleCount - (profile[0].sampleCount || 0) >= PROFILE_REFRESH_INTERVAL
  } catch {
    return false
  }
}

// 用 AI 对比 "AI 原稿 vs 用户终稿" 的差异，生成/更新风格画像
export async function updateStyleProfile(platform: string): Promise<string | null> {
  const samples = db.$client
    .prepare(
      `
    SELECT ai_original, content, title
    FROM drafts
    WHERE platform = ?
      AND ai_original != ''
      AND content != ai_original
      AND length(content) > 50
    ORDER BY updated_at DESC
    LIMIT 20
  `
    )
    .all(platform) as Array<{ ai_original: string; content: string; title: string }>

  if (samples.length < MIN_SAMPLES_FOR_PROFILE) return null

  const comparisonText = samples
    .map(
      (s, i) =>
        `=== 样本 ${i + 1} ===\n【AI 原稿】\n${s.ai_original.slice(0, 800)}\n\n【用户终稿】\n${s.content.slice(0, 800)}`
    )
    .join('\n\n---\n\n')

  try {
    const { object } = await generateObject({
      model: getModels().fast,
      schema: styleSchema,
      prompt: `你是一个写作风格分析 AI。对比以下 "AI 原稿" 和 "用户终稿" 的差异，总结用户在 ${platform} 平台上的写作风格特征。

分析维度：
1. 语气（正式/轻松/专业/俏皮）
2. 句式偏好（长句/短句/段落结构）
3. 用词习惯（常用词汇、行业术语）
4. 常见修改模式（用户倾向于添加/删除/改写什么）
5. 个人特色（emoji 使用、标点习惯、开头结尾方式）

样本数据：

${comparisonText}

请生成一段 200-300 字的风格画像，直接描述用户风格（使用 "用户偏好..." / "倾向于..." 这样的句式），不要分点列出。`,
    })

    const now = new Date().toISOString()
    const existing = db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.id, platform))
      .all()

    if (existing.length === 0) {
      db.insert(styleProfiles)
        .values({
          id: platform,
          platform,
          profile: object.profile,
          sampleCount: samples.length,
          updatedAt: now,
        })
        .run()
    } else {
      db.update(styleProfiles)
        .set({
          profile: object.profile,
          sampleCount: samples.length,
          updatedAt: now,
        })
        .where(eq(styleProfiles.id, platform))
        .run()
    }

    console.log(`[style] ${platform} 风格画像已更新 (基于 ${samples.length} 条样本)`)
    return object.profile
  } catch (err) {
    console.error('[style] 风格画像生成失败:', err)
    return null
  }
}

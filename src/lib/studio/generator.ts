import { generateObject } from 'ai'
import { getModels } from '@/lib/ai/client'
import { getDraft, updateDraft } from './queries'
import { xhsSchema, buildXhsPrompt, formatXhsToMarkdown } from './platforms/xhs'
import { twitterSchema, buildTwitterPrompt, formatTwitterToMarkdown } from './platforms/twitter'
import { articleSchema, buildArticlePrompt, formatArticleToMarkdown } from './platforms/article'
import { getStyleProfile, shouldUpdateStyleProfile, updateStyleProfile } from './style-learning'
import { snapshotDraft } from './versions'

const platformConfigs = {
  xhs: { schema: xhsSchema, buildPrompt: buildXhsPrompt, formatToMarkdown: formatXhsToMarkdown },
  twitter: { schema: twitterSchema, buildPrompt: buildTwitterPrompt, formatToMarkdown: formatTwitterToMarkdown },
  article: { schema: articleSchema, buildPrompt: buildArticlePrompt, formatToMarkdown: formatArticleToMarkdown },
} as const

export async function generateContent(draftId: string) {
  const draft = getDraft(draftId)
  if (!draft) throw new Error('草稿不存在')

  const platform = draft.platform as keyof typeof platformConfigs
  const config = platformConfigs[platform]
  if (!config) throw new Error(`不支持的平台: ${platform}`)

  // 收集素材
  const sources = draft.sources.map(s => ({
    title: s.title || '',
    oneLiner: s.oneLiner || '',
    source: s.source || '',
  }))

  if (sources.length === 0) throw new Error('没有素材，请先添加文章')

  // 注入风格画像（可能为 null，首次使用或样本不足时）
  const stylePrompt = getStyleProfile(platform)

  // 组装 prompt
  const prompt = config.buildPrompt(sources, stylePrompt)

  // 调用 AI 之前 snapshot 当前内容（若非空），作为"重新生成前的版本"
  snapshotDraft(draftId, 'pre_regenerate')

  // 调用 AI
  const { object } = await generateObject({
    model: getModels().quality,
    schema: config.schema,
    prompt,
  })

  // 格式化为 Markdown
  const markdown = config.formatToMarkdown(object as never)

  // 更新草稿：content 和 aiOriginal 在此刻是同一份内容，
  // 用户后续编辑 content 后，diff 就能反映本次生成的风格偏好
  updateDraft(draftId, {
    content: markdown,
    aiOriginal: markdown,
    title: (object as { title?: string }).title || draft.title,
    aiPrompt: prompt,
  })

  // AI 生成完成后 snapshot 新内容
  snapshotDraft(draftId, 'ai_generate')

  // 异步触发风格画像更新，不阻塞本次生成返回
  if (shouldUpdateStyleProfile(platform)) {
    updateStyleProfile(platform).catch(err =>
      console.error('[generator] 风格画像异步更新失败:', err)
    )
  }

  return { content: markdown, raw: object }
}

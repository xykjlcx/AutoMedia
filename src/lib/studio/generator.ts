import { generateObject, generateText } from 'ai'
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

  // 无素材分支：基于已有内容润色扩写
  if (sources.length === 0) {
    if (!draft.content?.trim()) throw new Error('没有素材也没有内容，请先写点内容或添加素材')

    const stylePrompt = getStyleProfile(platform)

    const platformHints: Record<string, string> = {
      xhs: '小红书风格：活泼亲切，善用 emoji，段落短促有节奏感',
      twitter: 'Twitter 风格：精炼有力，观点鲜明，适合碎片化阅读',
      article: '公众号长文风格：结构清晰，论述有深度，专业但不枯燥',
    }

    const systemPrompt = [
      '你是一位专业的中文内容创作者。',
      platformHints[platform] || '',
      stylePrompt ? `用户的写作风格偏好：${stylePrompt}` : '',
      '基于用户已有的草稿内容，进行优化：改善结构、润色表达、补充细节。',
      '保持原文的核心观点和素材，不要凭空捏造事实。',
      '输出完整的优化后文本（Markdown 格式），不要解释你做了什么。',
    ].filter(Boolean).join('\n')

    snapshotDraft(draftId, 'pre_regenerate')

    const { text: result } = await generateText({
      model: getModels().quality,
      system: systemPrompt,
      prompt: `标题：${draft.title || '(无标题)'}\n\n正文：\n${draft.content}`,
    })

    const markdown = result.trim()
    updateDraft(draftId, {
      content: markdown,
      aiOriginal: markdown,
      aiPrompt: systemPrompt,
    })

    snapshotDraft(draftId, 'ai_generate')

    return { content: markdown, raw: { title: draft.title } }
  }

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

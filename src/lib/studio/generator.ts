import { generateObject } from 'ai'
import { getModels } from '@/lib/ai/client'
import { getDraft, updateDraft } from './queries'
import { xhsSchema, buildXhsPrompt, formatXhsToMarkdown } from './platforms/xhs'
import { twitterSchema, buildTwitterPrompt, formatTwitterToMarkdown } from './platforms/twitter'
import { articleSchema, buildArticlePrompt, formatArticleToMarkdown } from './platforms/article'

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

  // 组装 prompt
  const prompt = config.buildPrompt(sources)

  // 调用 AI
  const { object } = await generateObject({
    model: getModels().quality,
    schema: config.schema,
    prompt,
  })

  // 格式化为 Markdown
  const markdown = config.formatToMarkdown(object as never)

  // 更新草稿
  updateDraft(draftId, {
    content: markdown,
    title: (object as { title?: string }).title || draft.title,
    aiPrompt: prompt,
  })

  return { content: markdown, raw: object }
}

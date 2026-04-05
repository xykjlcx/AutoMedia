import { z } from 'zod'

export const xhsSchema = z.object({
  title: z.string().describe('标题，带 emoji，吸引眼球'),
  body: z.string().describe('正文，Markdown 格式，分段短句，300-800 字'),
  tags: z.array(z.string()).describe('3-5 个话题标签'),
  cover_suggestion: z.string().describe('封面图建议文案'),
})

export type XhsOutput = z.infer<typeof xhsSchema>

export function buildXhsPrompt(
  sources: Array<{ title: string; oneLiner: string; summary?: string; source: string }>,
  stylePrompt?: string | null,
) {
  const sourceList = sources.map((s, i) =>
    `[${i + 1}] 来源:${s.source} | ${s.title}\n${s.oneLiner}${s.summary ? `\n${s.summary}` : ''}`
  ).join('\n\n')

  const styleSection = stylePrompt
    ? `\n用户写作风格参考（请遵循以下风格生成内容）：\n${stylePrompt}\n`
    : ''

  return `你是一个小红书内容创作者，面向关注 AI、跨境电商、技术变革的受众。

基于以下资讯素材，创作一篇小红书帖子：

${sourceList}
${styleSection}
要求：
- 标题：带 emoji，吸引眼球，20 字以内
- 正文：分段短句，每段 2-3 行，总计 300-800 字
- 语气：专业但不枯燥，有观点有态度
- 标签：3-5 个相关话题 tag（不带 # 号）
- 封面建议：一句话描述适合的封面图风格`
}

export function formatXhsToMarkdown(output: XhsOutput): string {
  const tags = output.tags.map(t => `#${t}`).join(' ')
  return `# ${output.title}\n\n${output.body}\n\n---\n${tags}\n\n> 封面建议：${output.cover_suggestion}`
}

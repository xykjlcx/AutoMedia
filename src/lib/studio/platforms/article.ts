import { z } from 'zod'

export const articleSchema = z.object({
  title: z.string().describe('文章标题，简洁有力'),
  abstract: z.string().describe('一句话摘要'),
  body: z.string().describe('正文，Markdown 格式，含小标题，1000-3000 字'),
  sections: z.array(z.string()).describe('小标题列表'),
})

export type ArticleOutput = z.infer<typeof articleSchema>

export function buildArticlePrompt(sources: Array<{ title: string; oneLiner: string; summary?: string; source: string }>) {
  const sourceList = sources.map((s, i) =>
    `[${i + 1}] 来源:${s.source} | ${s.title}\n${s.oneLiner}${s.summary ? `\n${s.summary}` : ''}`
  ).join('\n\n')

  return `你是一个公众号长文作者，面向关注 AI、跨境电商、技术变革的全栈开发者。

基于以下资讯素材，创作一篇深度分析文章：

${sourceList}

要求：
- 标题：简洁有力，不超过 25 字
- 摘要：一句话概括文章核心观点
- 正文：小标题分段，深度分析，1000-3000 字
- 每个段落要有观点，不只是复述资讯
- 结尾有总结和展望
- 输出 sections 列表方便生成目录`
}

export function formatArticleToMarkdown(output: ArticleOutput): string {
  return `# ${output.title}\n\n> ${output.abstract}\n\n${output.body}`
}

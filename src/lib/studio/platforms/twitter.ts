import { z } from 'zod'

export const twitterSchema = z.object({
  tweets: z.array(z.object({
    index: z.number(),
    content: z.string().describe('推文内容，≤280 字'),
  })),
})

export type TwitterOutput = z.infer<typeof twitterSchema>

export function buildTwitterPrompt(sources: Array<{ title: string; oneLiner: string; summary?: string; source: string }>) {
  const sourceList = sources.map((s, i) =>
    `[${i + 1}] 来源:${s.source} | ${s.title}\n${s.oneLiner}${s.summary ? `\n${s.summary}` : ''}`
  ).join('\n\n')

  return `你是一个 Twitter 内容创作者，面向关注 AI、跨境电商、技术变革的英文/中文受众。

基于以下资讯素材，创作一个 Twitter Thread：

${sourceList}

要求：
- 第 1 条（Hook）：抓注意力，引起好奇
- 中间条：每条一个要点，≤280 字
- 最后一条：总结 + CTA（关注/转发）
- 总计 3-10 条推文
- 语气：简洁有力，信息密度高`
}

export function formatTwitterToMarkdown(output: TwitterOutput): string {
  return output.tweets.map((t, i) =>
    `**[${i + 1}/${output.tweets.length}]** (${t.content.length} 字)\n\n${t.content}`
  ).join('\n\n---\n\n')
}

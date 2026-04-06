import Parser from 'rss-parser'
import type { CollectedItem, Collector } from './types'

const parser = new Parser()

const RSSHUB_BASE = process.env.RSSHUB_BASE_URL || 'https://rsshub.rssforever.com'

export const rssCollector: Collector = {
  name: 'rss',

  async collect(sourceId: string, config: Record<string, string>): Promise<CollectedItem[]> {
    // 优先使用完整 URL（自定义 RSS），否则拼接 RSSHub 路径
    const feedUrl = config.rssUrl || (config.rssPath ? `${RSSHUB_BASE}${config.rssPath}` : '')
    if (!feedUrl) throw new Error(`RSS path not configured for source: ${sourceId}`)

    // 用 fetch 获取 XML（避免 rss-parser 内置 http 模块的 DNS/IPv6 兼容问题）
    // 5xx 或网络错误时重试 1 次，间隔 2s（知乎等 RSSHub 实例偶发 503）
    const fetchOpts: RequestInit = {
      headers: { 'User-Agent': 'AutoMedia/1.0' },
      signal: AbortSignal.timeout(30000),
    }
    let response: Response
    try {
      response = await fetch(feedUrl, fetchOpts)
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`)
    } catch {
      await new Promise(r => setTimeout(r, 2000))
      response = await fetch(feedUrl, { ...fetchOpts, signal: AbortSignal.timeout(30000) })
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${feedUrl}`)
    const xml = await response.text()
    const feed = await parser.parseString(xml)

    // 每源上限 30 条，避免某些 RSS feed 返回全部历史文章（如 OpenAI Blog 903 条）
    const maxItems = Number(config.maxItems) || 30
    return (feed.items || []).slice(0, maxItems).map(item => ({
      source: sourceId,
      sourceType: 'public' as const,
      title: item.title?.trim() || '',
      content: stripHtml(item.contentSnippet || item.content || '').slice(0, 2000),
      url: item.link || '',
      author: item.creator || item.author || '',
    })).filter(item => item.title && item.url)
  },
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

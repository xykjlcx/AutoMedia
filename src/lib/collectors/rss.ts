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
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'AutoMedia/1.0' },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${feedUrl}`)
    const xml = await response.text()
    const feed = await parser.parseString(xml)

    return (feed.items || []).map(item => ({
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

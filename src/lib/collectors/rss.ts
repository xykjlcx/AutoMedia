import Parser from 'rss-parser'
import type { CollectedItem, Collector } from './types'

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AutoMedia/1.0',
  },
})

const RSSHUB_BASE = process.env.RSSHUB_BASE_URL || 'http://localhost:1200'

export const rssCollector: Collector = {
  name: 'rss',

  async collect(sourceId: string, config: Record<string, string>): Promise<CollectedItem[]> {
    const rssPath = config.rssPath
    if (!rssPath) throw new Error(`RSS path not configured for source: ${sourceId}`)

    const feedUrl = `${RSSHUB_BASE}${rssPath}`
    const feed = await parser.parseURL(feedUrl)

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

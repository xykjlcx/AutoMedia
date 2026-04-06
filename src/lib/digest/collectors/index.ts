import { rssCollector } from './rss'
import { twitterPublicCollector } from './twitter-public'
import { twitterPrivateCollector } from './twitter-private'
import { xiaohongshuPrivateCollector } from './xiaohongshu-private'
import type { Collector } from './types'

// source.type → collector 的映射表
const collectorMap: Record<string, Collector> = {
  'public': rssCollector,
  'custom-rss': rssCollector,
  'twitter-public': twitterPublicCollector,
  'twitter-private': twitterPrivateCollector,
  'xiaohongshu-private': xiaohongshuPrivateCollector,
}

// 根据 source.type 选择对应的 collector；未识别时返回 null
export function pickCollector(sourceType: string): Collector | null {
  return collectorMap[sourceType] || null
}

export { rssCollector, twitterPublicCollector, twitterPrivateCollector, xiaohongshuPrivateCollector }

export interface SourceConfig {
  id: string
  name: string
  icon: string // emoji
  type: 'public' | 'private'
  rssPath?: string
  targetUrl?: string
  enabled: boolean
}

export const sources: SourceConfig[] = [
  // 公域源（RSSHub）
  {
    id: 'github',
    name: 'GitHub Trending',
    icon: '💻',
    type: 'public',
    rssPath: '/github/trending/daily/any',
    enabled: true,
  },
  {
    id: 'juejin',
    name: '掘金',
    icon: '⛏️',
    type: 'public',
    rssPath: '/juejin/trending/all/daily',
    enabled: true,
  },
  {
    id: 'zhihu',
    name: '知乎热榜',
    icon: '🔍',
    type: 'public',
    rssPath: '/zhihu/hot',
    enabled: true,
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    icon: '🚀',
    type: 'public',
    rssPath: '/producthunt/today',
    enabled: true,
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: '📰',
    type: 'public',
    rssPath: '/hackernews/best',
    enabled: true,
  },
  // 私域源（浏览器自动化，MVP 暂不启用）
  {
    id: 'twitter',
    name: 'Twitter',
    icon: '🐦',
    type: 'private',
    targetUrl: 'https://x.com/home',
    enabled: false,
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    type: 'private',
    targetUrl: 'https://www.xiaohongshu.com/explore',
    enabled: false,
  },
  {
    id: 'wechat',
    name: '公众号',
    icon: '📖',
    type: 'private',
    targetUrl: 'https://mp.weixin.qq.com',
    enabled: false,
  },
]

export function getEnabledSources() {
  return sources.filter(s => s.enabled)
}

export function getPublicSources() {
  return sources.filter(s => s.type === 'public' && s.enabled)
}

export function getPrivateSources() {
  return sources.filter(s => s.type === 'private' && s.enabled)
}

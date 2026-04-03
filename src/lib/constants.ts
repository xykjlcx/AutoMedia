// 来源对应的主题色
export const SOURCE_COLORS: Record<string, string> = {
  github: '#6e40c9',
  juejin: '#1E80FF',
  zhihu: '#0066FF',
  producthunt: '#DA552F',
  hackernews: '#FF6600',
  twitter: '#1DA1F2',
  xiaohongshu: '#FE2C55',
  wechat: '#07C160',
  '36kr': '#0078FF',
  sspai: '#DA282A',
}

// 来源对应的 emoji 和中文名
export const SOURCE_META: Record<string, { icon: string; name: string }> = {
  github: { icon: '💻', name: 'GitHub Trending' },
  juejin: { icon: '⛏️', name: '掘金' },
  zhihu: { icon: '🔍', name: '知乎热榜' },
  producthunt: { icon: '🚀', name: 'Product Hunt' },
  hackernews: { icon: '📰', name: 'Hacker News' },
  twitter: { icon: '🐦', name: 'Twitter' },
  xiaohongshu: { icon: '📕', name: '小红书' },
  wechat: { icon: '📖', name: '公众号' },
  '36kr': { icon: '📊', name: '36氪' },
  sspai: { icon: '📱', name: '少数派' },
}

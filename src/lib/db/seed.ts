import { db } from './index'
import { sourceConfigs } from './schema'

const DEFAULT_SOURCES = [
  { id: 'github', name: 'GitHub Trending', icon: '💻', type: 'public' as const, rssPath: '/github/trending/daily/any', sortOrder: 0 },
  { id: 'juejin', name: '掘金', icon: '⛏️', type: 'public' as const, rssPath: '/juejin/trending/all/daily', sortOrder: 1 },
  { id: 'zhihu', name: '知乎热榜', icon: '🔍', type: 'public' as const, rssPath: '/zhihu/hot', sortOrder: 2 },
  { id: 'producthunt', name: 'Product Hunt', icon: '🚀', type: 'public' as const, rssPath: '/producthunt/today', sortOrder: 3 },
  { id: 'hackernews', name: 'Hacker News', icon: '📰', type: 'public' as const, rssPath: '/hackernews/best', sortOrder: 4 },
  { id: 'twitter', name: 'Twitter', icon: '🐦', type: 'private' as const, targetUrl: 'https://x.com/home', enabled: false, sortOrder: 5 },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', type: 'private' as const, targetUrl: 'https://www.xiaohongshu.com/explore', enabled: false, sortOrder: 6 },
  { id: 'wechat', name: '公众号', icon: '📖', type: 'private' as const, targetUrl: 'https://mp.weixin.qq.com', enabled: false, sortOrder: 7 },
]

export function seedDefaultSources() {
  try {
    const existing = db.select().from(sourceConfigs).all()
    if (existing.length > 0) return
  } catch {
    // 表可能还不存在（migration 未执行），跳过 seed
    return
  }

  const now = new Date().toISOString()
  for (const s of DEFAULT_SOURCES) {
    db.insert(sourceConfigs).values({
      ...s,
      rssPath: s.rssPath || '',
      rssUrl: '',
      targetUrl: s.targetUrl || '',
      enabled: s.enabled !== false,
      maxItems: 5,
      createdAt: now,
    }).onConflictDoNothing().run()
  }
}

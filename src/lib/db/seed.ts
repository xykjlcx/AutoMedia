import { eq } from 'drizzle-orm'
import { db } from './index'
import { sourceConfigs } from './schema'

const DEFAULT_SOURCES = [
  { id: 'github', name: 'GitHub Trending', icon: '💻', type: 'public' as const, rssPath: '/github/trending/daily/any', sortOrder: 0 },
  { id: '36kr', name: '36氪', icon: '📊', type: 'public' as const, rssPath: '/36kr/newsflashes', sortOrder: 1 },
  { id: 'zhihu', name: '知乎热榜', icon: '🔍', type: 'public' as const, rssPath: '/zhihu/hot', sortOrder: 2 },
  { id: 'sspai', name: '少数派', icon: '📱', type: 'public' as const, rssPath: '/sspai/index', sortOrder: 3 },
  { id: 'hackernews', name: 'Hacker News', icon: '📰', type: 'public' as const, rssPath: '/hackernews/best', sortOrder: 4 },
  { id: 'twitter', name: 'Twitter 时间线', icon: '🐦', type: 'twitter-private' as const, targetUrl: 'https://x.com/home', enabled: false, sortOrder: 5 },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', type: 'xiaohongshu-private' as const, targetUrl: 'https://www.xiaohongshu.com/explore', enabled: false, sortOrder: 6 },
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
      maxItems: 20,
      createdAt: now,
    }).onConflictDoNothing().run()
  }
}

// 迁移：替换不可用的 RSS 源
export function migrateRssSources() {
  try {
    const now = new Date().toISOString()
    // 添加新源（如果不存在）
    const newSources = [
      { id: '36kr', name: '36氪', icon: '📊', type: 'public', rssPath: '/36kr/newsflashes', sortOrder: 1 },
      { id: 'sspai', name: '少数派', icon: '📱', type: 'public', rssPath: '/sspai/index', sortOrder: 3 },
    ]
    for (const s of newSources) {
      db.insert(sourceConfigs).values({
        ...s,
        rssUrl: '',
        targetUrl: '',
        enabled: true,
        maxItems: 20,
        createdAt: now,
      }).onConflictDoNothing().run()
    }
    // 禁用不可用的源
    db.update(sourceConfigs).set({ enabled: false }).where(eq(sourceConfigs.id, 'juejin')).run()
    db.update(sourceConfigs).set({ enabled: false }).where(eq(sourceConfigs.id, 'producthunt')).run()
    // Twitter legacy 'private' 类型升级到 'twitter-private'（幂等）
    db.update(sourceConfigs).set({ type: 'twitter-private' })
      .where(eq(sourceConfigs.id, 'twitter'))
      .run()
    // 小红书 legacy 'private' 类型升级到 'xiaohongshu-private'（幂等）
    db.update(sourceConfigs).set({ type: 'xiaohongshu-private' })
      .where(eq(sourceConfigs.id, 'xiaohongshu'))
      .run()
    // 禁用无 collector 的 wechat 源（type='private' 无对应 collector）
    db.update(sourceConfigs).set({ enabled: false })
      .where(eq(sourceConfigs.type, 'private'))
      .run()
    // 禁用已 404 的 Shopify Blog RSS
    db.update(sourceConfigs).set({ enabled: false })
      .where(eq(sourceConfigs.rssUrl, 'https://www.shopify.com/blog/feed'))
      .run()
  } catch {
    // 静默失败
  }
}

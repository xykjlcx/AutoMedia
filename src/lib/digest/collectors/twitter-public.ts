import { rssCollector } from './rss'
import type { Collector, CollectedItem } from './types'

// Twitter 公开推文采集：底层复用 RSS，走 RSSHub 的 /twitter/user/:username 路由
export const twitterPublicCollector: Collector = {
  name: 'twitter-public',

  async collect(sourceId, config): Promise<CollectedItem[]> {
    const items = await rssCollector.collect(sourceId, config)
    // sourceType 保持 public（因为公开推文不需登录）
    return items.map<CollectedItem>(it => ({
      ...it,
      sourceType: 'public',
    }))
  },
}

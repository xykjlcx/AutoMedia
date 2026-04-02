import type { CollectedItem, Collector } from './types'

// 私域采集器——需要 Agent Browser 连接本机 Chrome
// MVP 阶段预留接口，后续实现各平台的具体采集逻辑
export const browserCollector: Collector = {
  name: 'browser',

  async collect(sourceId: string, _config: Record<string, string>): Promise<CollectedItem[]> {
    console.log(`[browser] 私域采集器暂未实现: ${sourceId}，跳过`)
    return []
  },
}

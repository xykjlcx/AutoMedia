export interface CollectedItem {
  source: string
  sourceType: 'public' | 'private'
  title: string
  content: string
  url: string
  author: string
}

export interface Collector {
  name: string
  collect(sourceId: string, config: Record<string, string>): Promise<CollectedItem[]>
}

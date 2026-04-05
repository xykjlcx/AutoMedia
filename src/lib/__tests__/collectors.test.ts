import { describe, it, expect } from 'vitest'
import { pickCollector } from '@/lib/digest/collectors'

// Spec 3：collector 多态派发单元测试
describe('collector dispatch', () => {
  it('returns rssCollector for public type', () => {
    const c = pickCollector('public')
    expect(c).toBeTruthy()
    expect(c?.name).toBe('rss')
  })

  it('returns rssCollector for custom-rss type', () => {
    const c = pickCollector('custom-rss')
    expect(c?.name).toBe('rss')
  })

  it('returns twitter-public collector for twitter-public type', () => {
    const c = pickCollector('twitter-public')
    expect(c?.name).toBe('twitter-public')
  })

  it('returns twitter-private collector for twitter-private type', () => {
    const c = pickCollector('twitter-private')
    expect(c?.name).toBe('twitter-private')
  })

  it('returns null for unknown type', () => {
    const c = pickCollector('unknown-type')
    expect(c).toBeNull()
  })

  it('returns null for legacy private type (no collector)', () => {
    // legacy 'private' 类型（xiaohongshu / wechat）没有对应 collector，应返回 null
    const c = pickCollector('private')
    expect(c).toBeNull()
  })
})

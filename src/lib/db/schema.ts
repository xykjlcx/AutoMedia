import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// 原始采集数据
export const rawItems = sqliteTable('raw_items', {
  id: text('id').primaryKey(), // UUID
  source: text('source').notNull(), // twitter | xiaohongshu | github | wechat | zhihu | juejin | producthunt | hackernews
  sourceType: text('source_type').notNull(), // public | private
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  url: text('url').notNull(),
  author: text('author').default(''),
  rawData: text('raw_data', { mode: 'json' }),
  digestDate: text('digest_date').notNull(), // YYYY-MM-DD
  collectedAt: text('collected_at').notNull(), // ISO 8601
})

// AI 处理后的精选条目
export const digestItems = sqliteTable('digest_items', {
  id: text('id').primaryKey(),
  digestDate: text('digest_date').notNull(),
  source: text('source').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  author: text('author').default(''),
  aiScore: real('ai_score').notNull(),
  oneLiner: text('one_liner').notNull(), // 一句话概述
  summary: text('summary').notNull(), // 详细摘要
  clusterId: text('cluster_id'),
  clusterSources: text('cluster_sources', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  trendTag: text('trend_tag'), // 趋势标签
})

// 收藏
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  note: text('note').default(''),
  createdAt: text('created_at').notNull(),
})

// AI 模型配置
export const aiSettings = sqliteTable('ai_settings', {
  id: text('id').primaryKey(), // 固定 'default'
  provider: text('provider').notNull().default('anthropic'), // anthropic | openai-compatible | google
  baseUrl: text('base_url').default(''), // OpenAI 兼容接口的 base URL
  apiKey: text('api_key').default(''),
  fastModel: text('fast_model').notNull().default('claude-haiku-4-5-20251001'), // 评分/聚类用的快速模型
  qualityModel: text('quality_model').notNull().default('claude-sonnet-4-6'), // 摘要用的高质量模型
  updatedAt: text('updated_at').notNull(),
})

// 日报执行记录
export const digestRuns = sqliteTable('digest_runs', {
  id: text('id').primaryKey(),
  digestDate: text('digest_date').notNull(),
  status: text('status').notNull(), // collecting | processing | completed | failed
  progress: text('progress', { mode: 'json' }),
  rawCount: integer('raw_count').default(0),
  filteredCount: integer('filtered_count').default(0),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  errors: text('errors', { mode: 'json' }).$type<Record<string, string>>(),
})

// 信息源配置
export const sourceConfigs = sqliteTable('source_configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('📰'),
  type: text('type').notNull(), // 'public' | 'private' | 'custom-rss'
  rssPath: text('rss_path').default(''),
  rssUrl: text('rss_url').default(''),
  targetUrl: text('target_url').default(''),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  maxItems: integer('max_items').default(5),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').notNull(),
})

// 用户评价
export const userRatings = sqliteTable('user_ratings', {
  id: text('id').primaryKey(),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  rating: text('rating').notNull(), // 'like' | 'dislike'
  createdAt: text('created_at').notNull(),
})

// 用户偏好画像（AI 生成的摘要）
export const userProfile = sqliteTable('user_profile', {
  id: text('id').primaryKey(), // 固定 'default'
  profile: text('profile').notNull(), // AI 生成的偏好描述
  ratingCount: integer('rating_count').default(0),
  updatedAt: text('updated_at').notNull(),
})

// 定时任务配置
export const scheduleConfig = sqliteTable('schedule_config', {
  id: text('id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  cronExpression: text('cron_expression').default('0 6 * * *'),
  telegramEnabled: integer('telegram_enabled', { mode: 'boolean' }).default(false),
  telegramBotToken: text('telegram_bot_token').default(''),
  telegramChatId: text('telegram_chat_id').default(''),
  updatedAt: text('updated_at').notNull(),
})

// 内容草稿
export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  platform: text('platform').notNull(), // 'xhs' | 'twitter' | 'article'
  content: text('content').notNull().default(''),
  status: text('status').notNull().default('draft'), // 'draft' | 'final' | 'exported'
  aiPrompt: text('ai_prompt').default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// 草稿素材关联
export const draftSources = sqliteTable('draft_sources', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => drafts.id, { onDelete: 'cascade' }),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').notNull(),
})

// 分享卡片
export const shareCards = sqliteTable('share_cards', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').references(() => drafts.id),
  digestItemId: text('digest_item_id').references(() => digestItems.id),
  template: text('template').notNull().default('default'),
  copyText: text('copy_text').notNull().default(''),
  imagePath: text('image_path').default(''),
  createdAt: text('created_at').notNull(),
})

// 话题实体（知识图谱）
export const topicEntities = sqliteTable('topic_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'person' | 'company' | 'product' | 'technology'
  firstSeenDate: text('first_seen_date').notNull(),
  mentionCount: integer('mention_count').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
})

// 文章-实体关联
export const articleRelations = sqliteTable('article_relations', {
  id: text('id').primaryKey(),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  entityId: text('entity_id').notNull().references(() => topicEntities.id),
  relationType: text('relation_type').notNull(), // 'mentions' | 'about' | 'related'
  createdAt: text('created_at').notNull(),
})

// 用户行为事件
export const userEvents = sqliteTable('user_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(), // 'read' | 'click' | 'favorite' | ...
  targetType: text('target_type').notNull(), // 'digest_item' | 'draft' | ...
  targetId: text('target_id').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
})

// 阅读位置记忆
export const readingPosition = sqliteTable('reading_position', {
  id: text('id').primaryKey(),
  pagePath: text('page_path').notNull(), // URL 路径，如 '/'、'/favorites'
  pageKey: text('page_key').notNull(), // 附加 key，如日期 '2026-04-05'
  scrollY: integer('scroll_y').notNull(), // 滚动位置
  updatedAt: text('updated_at').notNull(),
})

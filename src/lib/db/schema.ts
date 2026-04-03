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

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = process.env.DATABASE_PATH || './data/automedia.db'

// 确保 data 目录存在
const dir = dirname(dbPath)
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// FTS5 全文搜索虚拟表
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS digest_fts USING fts5(
    digest_item_id UNINDEXED,
    title,
    one_liner,
    summary,
    source UNINDEXED,
    digest_date UNINDEXED
  );
`)

// 常用查询索引
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_digest_items_date ON digest_items(digest_date)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_digest_items_source ON digest_items(source)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_raw_items_date ON raw_items(digest_date)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_ratings_item ON user_ratings(digest_item_id)`)

// 内容创作相关表
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    ai_prompt TEXT DEFAULT '',
    ai_original TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

// 为旧库幂等补齐 ai_original 列（SQLite 没有 ADD COLUMN IF NOT EXISTS）
try {
  sqlite.exec(`ALTER TABLE drafts ADD COLUMN ai_original TEXT DEFAULT ''`)
} catch {
  // 列已存在，忽略
}

// 写作风格画像（每个平台一条，id = platform）
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS style_profiles (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    profile TEXT NOT NULL,
    sample_count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS draft_sources (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    digest_item_id TEXT NOT NULL REFERENCES digest_items(id),
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS share_cards (
    id TEXT PRIMARY KEY,
    draft_id TEXT REFERENCES drafts(id),
    digest_item_id TEXT REFERENCES digest_items(id),
    template TEXT NOT NULL DEFAULT 'default',
    copy_text TEXT NOT NULL DEFAULT '',
    image_path TEXT DEFAULT '',
    created_at TEXT NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  )
`)

// 知识图谱相关表
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS topic_entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    first_seen_date TEXT NOT NULL,
    mention_count INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS article_relations (
    id TEXT PRIMARY KEY,
    digest_item_id TEXT NOT NULL REFERENCES digest_items(id),
    entity_id TEXT NOT NULL REFERENCES topic_entities(id),
    relation_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)

// 知识图谱相关索引
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_topic_entities_name ON topic_entities(name)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_topic_entities_type ON topic_entities(type)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_article_relations_item ON article_relations(digest_item_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_article_relations_entity ON article_relations(entity_id)`)
// 每篇文章与每个实体的关系唯一，避免 mention_count 被重复累加
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_relations_item_entity ON article_relations(digest_item_id, entity_id)`)

// 内容创作相关索引
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_drafts_platform ON drafts(platform)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_draft_sources_draft ON draft_sources(draft_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_share_cards_draft ON share_cards(draft_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_events_target ON user_events(target_type, target_id)`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at)`)

// RSS 源推荐（与 schema.ts 中的 sourceSuggestions 保持一致）
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS source_suggestions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    rss_url TEXT NOT NULL,
    category TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_source_suggestions_status ON source_suggestions(status)`)

// 阅读位置记忆
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS reading_position (
    id TEXT PRIMARY KEY,
    page_path TEXT NOT NULL,
    page_key TEXT NOT NULL,
    scroll_y INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_position_path_key ON reading_position(page_path, page_key)`)

export const db = drizzle(sqlite, { schema })

import { seedDefaultSources, migrateRssSources } from './seed'
seedDefaultSources()
migrateRssSources()

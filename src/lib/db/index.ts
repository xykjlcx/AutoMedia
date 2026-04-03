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

export const db = drizzle(sqlite, { schema })

import { seedDefaultSources, migrateRssSources } from './seed'
seedDefaultSources()
migrateRssSources()

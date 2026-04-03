# Changelog

## [1.0.0] - 2026-04-03

### 功能
- 多源并行 RSS 采集（GitHub Trending、知乎、Hacker News、36氪、少数派）
- AI 三维评分（相关性/新颖性/影响力）
- 跨源语义去重
- AI 摘要生成（一句话概述 + 详细摘要）
- 个性化训练（👍/👎 评价 → AI 偏好画像 → 评分个性化）
- 趋势追踪（跨天话题匹配，🔥 趋势标签）
- 增量 Pipeline（只处理新增内容，保留收藏/已读）
- SSE 实时进度推送 + 分阶段计时
- 全文搜索（SQLite FTS5）
- 收藏 + 标签管理
- 历史日报日历视图
- 周报/月报 AI 汇总
- 定时自动生成（node-cron）
- Telegram 推送通知
- 暗色模式

### 技术
- 采集阶段并行（Promise.allSettled）
- 评分/摘要 2 路并发
- Pipeline 写入事务化（better-sqlite3 native transaction）
- 模型实例缓存 + 配置变更自动清除
- 数据库索引优化

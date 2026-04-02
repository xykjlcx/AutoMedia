# AutoMedia

## 项目概述
AI 驱动的每日资讯聚合工具。从多平台采集内容，经 AI 筛选、去重、摘要后以日报形式展示。

## 技术栈
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- SQLite + Drizzle ORM
- Claude API (@anthropic-ai/sdk)
- RSSHub (Docker)

## 开发命令
- `pnpm dev` — 启动开发服务器
- `pnpm build` — 构建生产版本
- `pnpm db:generate` — 生成数据库迁移
- `pnpm db:migrate` — 执行数据库迁移
- `docker compose up -d` — 启动 RSSHub

## 目录规范
- `src/lib/collectors/` — 数据采集器
- `src/lib/ai/` — AI 处理管线
- `src/lib/db/` — 数据库相关
- `src/components/` — UI 组件

## 注意事项
- 代码英文，注释中文
- 数据库文件在 `data/` 目录，已 gitignore
- API Key 在 .env.local，不要提交

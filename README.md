# AutoMedia

AI 驱动的每日资讯聚合与内容生产力工具。从多平台采集内容，经 AI 评分、去重、摘要后以日报形式展示，并将资讯转化为可发布的内容。

## 预览

![首页 - 亮色模式](docs/screenshots/home-light.png)

<details>
<summary>暗色模式</summary>

![首页 - 暗色模式](docs/screenshots/home-dark.png)

</details>

## 功能特性

### 📰 资讯聚合
- **多源并行采集**：GitHub Trending、知乎热榜、Hacker News、36氪、少数派等
- **AI 智能处理**：三维评分（相关性/新颖性/影响力）、跨源去重、一句话概述 + 详细摘要
- **趋势追踪**：跨天话题匹配，连续出现的话题标记 🔥 趋势标签
- **个性化训练**：👍/👎 评价 → AI 偏好画像 → 评分自动适配你的口味
- **全文搜索**：SQLite FTS5 全文索引
- **定时生成**：node-cron 定时任务 + Telegram 推送通知
- **周报/月报**：AI 生成趋势分析 + 要闻汇总

### ✍️ 内容创作 (Studio)
- **AI 内容生成**：从日报选文章，一键生成小红书帖 / Twitter Thread / 公众号长文
- **写作风格学习**：从历史草稿对比学习用户风格，生成内容更贴合个人语气
- **分享卡片**：5 种模板（深色/简约/学术/小红书/暖色），satori + resvg 渲染 PNG
- **HTML/Markdown 导出**：一键导出发布
- **草稿历史**：所有草稿自动保存，支持继续编辑、删除

### 🔮 智能洞察 (Insights)
- **知识图谱**：AI 从文章提取实体（人物/公司/产品/技术），主从视图展示实体关联
- **力导图可视化**：Obsidian 风格的节点关系图（右侧 Drawer）
- **破圈预警**：检测话题跨源扩散（如 HN → 36氪 → 知乎），Telegram 主动推送
- **多源对比**：同一事件不同源的观点对比，AI 生成共识与分歧

### 📊 数据体验
- **阅读统计仪表盘**：阅读量、活跃天数、源分布、24h 阅读时段热力图、推荐命中率
- **阅读位置记忆**：关掉再打开从上次位置继续（支持所有浏览页面）

### 🔍 源发现
- **RSS 源推荐**：42 个内置高质量源目录 + AI 根据偏好推荐新源
- **一键添加**：发现感兴趣的源直接加入采集列表

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 数据库 | SQLite (better-sqlite3) + Drizzle ORM |
| AI | Vercel AI SDK (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai`) |
| 渲染 | satori + @resvg/resvg-js (分享卡片) |
| 可视化 | react-force-graph-2d (知识图谱) |
| RSS | RSSHub 公共实例 + rss-parser |
| 实时 | Server-Sent Events (EventEmitter + ReadableStream) |

## 快速开始

### 前置要求

- Node.js 20+
- pnpm

### 安装

```bash
git clone https://github.com/xykjlcx/AutoMedia.git
cd AutoMedia
pnpm install   # postinstall 会自动下载分享卡片所需的中文字体
```

### 配置

```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的配置
```

### 运行

```bash
pnpm db:generate   # 生成数据库迁移
pnpm db:migrate    # 执行迁移
pnpm dev           # 启动开发服务器
```

打开 http://localhost:3000，点击"生成今日日报"即可。

### AI 模型配置

在设置页面（`/settings`）配置 AI 模型：

- 支持 Anthropic 和 OpenAI 兼容协议
- 填入请求地址、API Key、模型名称
- **快速模型** 用于评分、去重、实体提取（推荐 Haiku / gpt-4o-mini）
- **质量模型** 用于摘要和内容生成（推荐 Sonnet / gpt-4o）

## 页面导航

| 路径 | 功能 |
|------|------|
| `/` | 今日日报 — 按源筛选、多选发送到 Studio |
| `/history` | 历史日报 — 日历式浏览 |
| `/favorites` | 收藏 — 标签 + 搜索 |
| `/summary` | 汇总 — 周报/月报 AI 分析 |
| `/insights` | 洞察 — 知识图谱 + 破圈预警 + 对比日报 |
| `/search` | 搜索 — FTS5 全文检索 |
| `/studio` | Studio — 内容创作工作台 |
| `/dashboard` | 数据 — 阅读统计仪表盘 |
| `/settings` | 设置 — 模型 / 信息源 / 定时任务 |

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── digest/         # 日报 API（触发/SSE流/数据）
│   │   ├── studio/         # Studio（草稿/生成/卡片/导出）
│   │   ├── insights/       # 洞察（图谱/预警/对比/实体详情）
│   │   ├── analytics/      # 统计聚合
│   │   ├── discovery/      # 源推荐
│   │   ├── events/         # 用户行为事件
│   │   ├── reading-position/  # 阅读位置
│   │   └── ...             # favorites / ratings / search / settings / sources
│   └── (pages)/            # 10 个功能页面
├── components/
│   ├── digest/             # 日报组件
│   ├── studio/             # Studio 工作台组件
│   ├── insights/           # 洞察组件（实体图谱、力导图 drawer 等）
│   ├── dashboard/          # 数据仪表盘
│   ├── favorites/          # 收藏
│   ├── layout/             # 导航、主题
│   └── hooks/              # 自定义 hooks（阅读位置、事件追踪）
└── lib/
    ├── ai/                 # 通用 AI 能力（provider、批处理、utils）
    ├── digest/             # Digest 域（采集、评分、聚类、摘要、趋势、实体提取、破圈预警、对比）
    ├── studio/             # Studio 域（生成、平台模板、卡片渲染、导出、风格学习）
    ├── analytics/          # 行为追踪 + 统计聚合
    ├── discovery/          # 源目录 + AI 推荐引擎
    ├── db/                 # 数据库 schema + 连接
    └── (公共)               # pipeline-events、scheduler、notify、sources、constants
```

## Pipeline 数据流

```
触发生成 → 并行采集（多源同时）
              ↓ URL 去重写入 raw_items
         增量过滤（跳过已有 URL）
              ↓
         AI 评分（2 路并发，每批 20 条）
              ↓
         跨源去重（AI 语义判断聚类）
              ↓
         AI 摘要（2 路并发，每批 5 条）
              ↓
         趋势分析（对比过去 7 天话题）
              ↓
         增量写入 digest_items
              ↓
         实体提取（人物/公司/产品/技术）
              ↓
         破圈检测 → Telegram 推送预警
              ↓
         完成 → Telegram 日报通知
```

## 部署

### Docker（推荐）

```bash
git clone https://github.com/xykjlcx/AutoMedia.git
cd AutoMedia
docker compose up -d
```

详细部署文档：[docs/deploy.md](docs/deploy.md)

## 开发命令

```bash
pnpm dev           # 开发服务器
pnpm build         # 生产构建
pnpm test          # 运行测试
pnpm lint          # 代码检查
pnpm db:generate   # 生成迁移
pnpm db:migrate    # 执行迁移
pnpm setup:fonts   # 手动下载中文字体（分享卡片需要）
```

## License

MIT

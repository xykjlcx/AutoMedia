# AutoMedia — 每日资讯聚合 设计文档

> 状态：Draft
> 日期：2026-04-02
> 阶段：MVP（资讯聚合，写作分发后续阶段实现）

---

## 1. 产品定位

一个 AI 驱动的每日资讯聚合工具，自动从多个平台采集内容，经 AI 筛选、去重、摘要后，以每日日报的形式在 Web 界面呈现。面向个人使用，解决"每天高效吸收多平台信息"的需求。

### 1.1 核心价值

- **信息降噪**：从每天几百条信息流中，AI 筛选出每源 3-5 条最值得关注的内容
- **跨源去重**：同一事件多平台报道时只展示一次，避免重复阅读
- **快速消化**：AI 生成摘要，30 秒了解一条资讯的核心内容
- **知识沉淀**：收藏 + 标签体系，为后续写作积累素材

### 1.2 明确排除（MVP 不做）

- 定时自动调度（手动触发）
- 消息推送通知（Telegram/Discord）
- 写作分发功能（后续阶段）
- 可训练的个性化推荐（需要数据积累）
- 摘要深度切换（先做一种固定格式）
- 多用户支持（个人工具）

---

## 2. 信息源

### 2.1 公域源（RSSHub）

| 源 | RSSHub 路由 | 内容类型 |
|---|---|---|
| GitHub Trending | `/github/trending/{language}/{since}` | 热门开源项目 |
| 掘金热门 | `/juejin/trending/{category}/{type}` | 技术文章 |
| 知乎热榜 | `/zhihu/hot` | 综合热点 |
| Product Hunt | `/producthunt/today` | 新产品 |
| HackerNews | `/hackernews/best` | 技术/创业资讯 |

### 2.2 私域源（浏览器自动化）

| 源 | 采集方式 | 内容类型 |
|---|---|---|
| Twitter/X | Agent Browser 登录态，抓取首页信息流 | 关注者动态 |
| 小红书 | Agent Browser 登录态，抓取关注页 | 关注者笔记 |
| 公众号 | Agent Browser 登录态，抓取订阅号消息 | 订阅号文章 |

### 2.3 关注领域

AI 评分时作为相关性参考的领域标签：

- AI / 大模型 / Agent
- 跨境电商 / Shopify / 独立站
- 技术变革 / 开发者工具
- 互联网产品 / 创业

---

## 3. 系统架构

```
┌─────────────┐     ┌──────────────┐
│   RSSHub    │     │Agent Browser │
│  (Docker)   │     │ (本机Chrome) │
└──────┬──────┘     └──────┬───────┘
       │  公域              │  私域
       └────────┬───────────┘
                ↓
         ┌─────────────┐
         │  采集脚本    │  ← Web 界面手动触发
         │  (Node.js)  │
         └──────┬──────┘
                ↓
         ┌─────────────┐
         │  AI 处理管线  │  ← Claude API
         │  评分→去重→摘要│
         └──────┬──────┘
                ↓
         ┌─────────────┐
         │   SQLite    │
         └──────┬──────┘
                ↓
         ┌─────────────┐
         │  Next.js    │
         │  Web App    │
         └─────────────┘
```

### 3.1 技术栈

| 层 | 技术 | 理由 |
|---|---|---|
| 前端 | Next.js + React + TypeScript + Tailwind + shadcn/ui | 用户常用栈 |
| 后端 | Next.js API Routes | 无需额外后端服务 |
| 数据库 | SQLite + Drizzle ORM | 个人工具，单文件零运维 |
| 公域采集 | RSSHub (Docker 自部署) | 社区维护，覆盖面广 |
| 私域采集 | Agent Browser（连接本机 Chrome） | 复用登录态 |
| AI 评分 | Claude Haiku API | 快速、低成本，批量评分 |
| AI 摘要 | Claude Sonnet API | 质量优先 |
| Embedding 去重 | text-embedding-3-small 或同级 | 轻量，内存计算即可 |

---

## 4. 数据模型

### 4.1 raw_items（原始采集数据）

```typescript
{
  id: string            // UUID
  source: string        // 'twitter' | 'xiaohongshu' | 'github' | 'wechat' | 'zhihu' | 'juejin' | 'producthunt' | 'hackernews'
  sourceType: string    // 'public' | 'private'
  title: string         // 标题
  content: string       // 原文内容或片段
  url: string           // 原文链接
  author: string        // 作者（可选）
  rawData: json         // 原始数据（保留完整信息）
  collectedAt: datetime // 采集时间
  digestDate: string    // 所属日报日期 YYYY-MM-DD
}
```

### 4.2 digest_items（AI 处理后的精选条目）

```typescript
{
  id: string
  digestDate: string      // 日报日期 YYYY-MM-DD
  source: string          // 来源平台
  title: string           // 标题
  url: string             // 原文链接
  author: string          // 作者
  aiScore: number         // AI 评分 0-10
  oneLiner: string        // 一句话概述（~30字）
  summary: string         // 详细摘要（~150字）
  clusterId: string       // 聚类 ID（跨源去重用）
  clusterSources: json    // 同事件的其他来源 ['zhihu', 'juejin']
  createdAt: datetime
}
```

### 4.3 favorites（收藏）

```typescript
{
  id: string
  digestItemId: string    // 关联的精选条目
  tags: json              // 标签数组 ['AI', '跨境电商']
  note: string            // 用户备注（可选）
  createdAt: datetime
}
```

### 4.4 digest_runs（日报执行记录）

```typescript
{
  id: string
  digestDate: string      // 日报日期
  status: string          // 'collecting' | 'processing' | 'completed' | 'failed'
  progress: json          // { step: 'collecting', source: 'twitter', detail: '...' }
  rawCount: number        // 原始采集条数
  filteredCount: number   // 筛选后条数
  startedAt: datetime
  completedAt: datetime
  errors: json            // 各源的错误记录
}
```

---

## 5. AI 处理管线

### 5.1 Stage 1: AI 评分筛选

- **模型**：Claude Haiku
- **输入**：raw_items 全部条目
- **处理**：批量调用，每次传入 10-20 条，返回每条的评分
- **评分维度**：
  - 相关性（0-10）：与关注领域的匹配度
  - 新颖性（0-10）：是否有新信息、新观点
  - 影响力（0-10）：对行业/技术的影响程度
- **综合分** = 三项加权平均（相关性 0.4 + 新颖性 0.3 + 影响力 0.3）
- **阈值**：≥ 6 分保留，每源上限 5 条（取 top 5）
- **Prompt 包含关注领域列表**，作为相关性判断的参考

### 5.2 Stage 2: 跨源去重聚类

- **方法**：对保留条目的标题 + 一句话概述做 Embedding
- **聚类**：计算两两余弦相似度，> 0.85 的归为同一事件
- **处理**：同一聚类内保留评分最高的条目作为主条目，其他条目的来源记录到 clusterSources
- **规模**：每天 30-50 条保留条目，O(n²) 相似度计算完全可行

### 5.3 Stage 3: AI 摘要生成

- **模型**：Claude Sonnet
- **输入**：去重后的条目（含原文内容/片段）
- **输出**：
  - `oneLiner`：一句话概述，~30 字，概括核心信息
  - `summary`：详细摘要，~150 字，包含"为什么值得关注"的解读
- **批量处理**：每次传入 5 条，减少 API 调用次数

---

## 6. Web 应用

### 6.1 页面结构

#### 首页 `/`（今日日报）

- 顶部：日期显示 + "生成今日日报"按钮
- 生成中：进度条/状态提示（采集中 → AI 处理中 → 完成）
- 生成后：按信息源分组展示精选条目
- 每条卡片：
  - 来源图标 + 标题
  - 一句话概述
  - 详细摘要（点击展开/收起）
  - 跨源标记（"知乎、掘金也在讨论"）
  - 原文链接
  - 收藏按钮

#### 历史页 `/history`

- 日历视图，可点击任意日期查看当天日报
- 日期上标记是否有日报数据

#### 收藏页 `/favorites`

- 收藏条目列表
- 按标签筛选
- 搜索收藏内容
- 支持添加/编辑标签和备注

### 6.2 交互细节

- **生成日报**：点击按钮后进入 loading 状态，轮询后端 digest_runs 的 progress 字段，实时显示进度
- **卡片展开**：默认只显示一句话概述，点击展开详细摘要，再次点击收起
- **收藏**：点击星标收藏，弹出标签选择（可多选已有标签或创建新标签）
- **日期切换**：首页支持前后翻页切换日期，也可通过历史页的日历跳转

---

## 7. 采集脚本设计

### 7.1 公域采集（RSSHub）

```
对每个配置的 RSS 源：
  1. fetch RSSHub 接口，获取 RSS XML
  2. 解析条目（标题、链接、内容、作者、发布时间）
  3. 按 url 去重（避免重复采集）
  4. 写入 raw_items
```

- 每个源独立采集，一个失败不阻塞其他
- 错误记录到 digest_runs.errors

### 7.2 私域采集（Agent Browser）

```
对每个私域源（Twitter / 小红书 / 公众号）：
  1. Agent Browser 连接本机 Chrome
  2. 导航到对应平台的信息流页面
  3. 滚动加载内容，抓取可见条目
  4. 提取标题、内容片段、链接、作者
  5. 写入 raw_items
```

- 需要用户提前在 Chrome 中登录各平台
- 采集脚本需要针对每个平台写专门的提取逻辑
- Agent Browser 的 snapshot + eval 能力用于页面元素提取

---

## 8. 项目结构

```
08-AutoMedia/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页（今日日报）
│   │   ├── history/
│   │   │   └── page.tsx        # 历史日报
│   │   ├── favorites/
│   │   │   └── page.tsx        # 收藏页
│   │   ├── api/
│   │   │   ├── digest/
│   │   │   │   ├── trigger/route.ts    # 触发生成日报
│   │   │   │   ├── status/route.ts     # 查询生成进度
│   │   │   │   └── [date]/route.ts     # 获取指定日期日报
│   │   │   └── favorites/
│   │   │       └── route.ts            # 收藏 CRUD
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema 定义
│   │   │   ├── index.ts        # 数据库连接
│   │   │   └── migrate.ts      # 迁移脚本
│   │   ├── collectors/
│   │   │   ├── rss.ts          # RSSHub 公域采集
│   │   │   ├── twitter.ts      # Twitter 私域采集
│   │   │   ├── xiaohongshu.ts  # 小红书私域采集
│   │   │   └── wechat.ts       # 公众号私域采集
│   │   ├── ai/
│   │   │   ├── scoring.ts      # AI 评分筛选
│   │   │   ├── clustering.ts   # Embedding 去重聚类
│   │   │   └── summarize.ts    # AI 摘要生成
│   │   └── pipeline.ts         # 串联采集 + AI 处理的主流程
│   └── components/
│       ├── digest-card.tsx      # 资讯卡片组件
│       ├── source-group.tsx     # 按源分组组件
│       ├── favorite-button.tsx  # 收藏按钮
│       ├── tag-selector.tsx     # 标签选择器
│       ├── date-picker.tsx      # 日期选择
│       └── progress-bar.tsx     # 生成进度
├── drizzle/                     # 数据库迁移文件
├── docker-compose.yml           # RSSHub 部署
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── CLAUDE.md                    # 项目级指令
```

---

## 9. 后续阶段规划（不在 MVP 范围内）

### Phase 2: 自动化增强
- 定时调度（node-cron / 系统 cron）
- Telegram/Discord 通知推送
- 采集失败自动重试

### Phase 3: 智能化增强
- 可训练个性化（用户反馈 → AI 学习偏好）
- 摘要深度切换（简洁/详细）
- 趋势追踪（连续几天的热点事件关联）

### Phase 4: 写作分发
- 选题推荐（从日报收藏中提取）
- 写作工作流（选题→初稿→润色→配图→排版）
- 一稿多发（小红书/公众号/Twitter 适配）
- 辅助发布（Agent Browser 自动化）

---

## 10. 竞品参考

| 项目 | 借鉴点 |
|---|---|
| Meridian (GitHub 2.4k⭐) | 多阶段 AI 管线架构、Embedding 聚类去重 |
| Horizon (GitHub 931⭐) | AI 评分过滤机制（0-10 分） |
| AutoContents (GitHub 319⭐) | 聚合→创作→分发全链路、小红书图片渲染 |
| Feedly Leo | 可训练个性化（Phase 3 参考） |
| Particle | 新闻聚类 + 多视角对比 |
| 今日热榜 | 中文多平台热榜聚合的切入角度 |

# AutoMedia v2 设计文档

## 概述

AutoMedia 从"阅读工具"升级为"内容生产力工具"。在现有采集→处理→展示链路基础上，新增内容创作、智能洞察、数据体验、源发现四个功能群组，分四个 Phase 交付。

## 设计范围

### 纳入

| 模块 | 功能 |
|------|------|
| 内容工作台 | 独立 `/studio` 页面，Markdown 编辑器，从日报勾选或收藏选素材 |
| AI 内容生成 | 小红书帖 / Twitter thread / 公众号文章，三种平台模板 |
| 分享卡片 | satori 渲染 PNG，预留 AI 生图扩展口 |
| HTML 导出 | 精选内容导出为 HTML，未来可接 Newsletter |
| 源推荐/发现 | 根据兴趣推荐新的公开 RSS 源 |
| 阅读统计仪表盘 | 阅读量、领域分布、趋势变化可视化 |
| 阅读位置记忆 | 关掉再打开从上次位置继续 |
| 知识图谱 | 文章关联关系可视化 + 破圈预警 |
| 对比日报 | 同一事件不同源的观点对比 |

### 明确排除

- Newsletter 发送（先做导出，发送后续再接）
- 写作风格学习（跑通后再加）
- 私域源采集（架构预留，采集方案待定）
- Obsidian 联动（和写作板块后续一起做）

---

## 架构设计

### 整体策略

务实架构 + DDD 目录组织。在分阶段推进的节奏下，Phase 1 就把会被后续复用的基础设施做对。

三个共享基础设施（Phase 1 建设）：
1. **批处理工具函数** — 从 scoring/summarize 中提取的通用批处理 + 并发控制逻辑
2. **内容草稿模型** — `drafts` 表作为工作台的数据核心
3. **用户行为追踪** — `user_events` 通用事件表，Phase 1 就开始记录

### 目录结构

```
src/lib/
├── digest/                 ← 现有代码迁移，保持原有逻辑
│   ├── pipeline.ts          采集管线（原 lib/pipeline.ts）
│   ├── collectors/          RSS 采集器（原 lib/collectors/）
│   ├── scoring.ts           评分（原 lib/ai/scoring.ts）
│   ├── clustering.ts        聚类（原 lib/ai/clustering.ts）
│   ├── summarize.ts         摘要（原 lib/ai/summarize.ts）
│   ├── trends.ts            趋势（原 lib/ai/trends.ts）
│   ├── preference.ts        偏好（原 lib/ai/preference.ts）
│   └── queries.ts           数据库查询
│
├── studio/                  ← 新建
│   ├── generator.ts         内容生成调度
│   ├── platforms/           各平台生成逻辑
│   │   ├── xhs.ts           小红书帖
│   │   ├── twitter.ts       Twitter thread
│   │   └── article.ts       公众号长文
│   ├── card-renderer.ts     分享卡片渲染（satori）
│   ├── exporter.ts          HTML/Markdown 导出
│   └── queries.ts           草稿 CRUD 查询
│
├── analytics/               ← Phase 3 再建
│
├── ai/                      ← 保留，只放真正通用的
│   ├── client.ts            Provider 管理（现有，不动）
│   ├── batch.ts             通用批处理函数（新增）
│   ├── utils.ts             extractJson 等工具（现有）
│   └── weekly-summary.ts    周报生成（现有，语义上属于 digest 域，但因为依赖 ai/client 且独立性强，暂留此处）
│
└── db/
    ├── schema.ts            所有表定义
    └── index.ts             连接管理
```

```
src/app/
├── api/
│   ├── digest/              现有 API
│   └── studio/              新增
│       ├── drafts/          草稿 CRUD
│       ├── generate/        AI 内容生成
│       ├── cards/           分享卡片
│       └── export/          导出
├── studio/                  新增页面
│   └── page.tsx
└── ...
```

```
src/components/
├── digest/                  现有组件
└── studio/                  新增
    ├── studio-page.tsx      工作台主页面
    ├── source-picker.tsx    素材选择器
    ├── draft-editor.tsx     Markdown 编辑器
    ├── platform-selector.tsx 平台选择
    ├── card-preview.tsx     卡片预览
    └── export-dialog.tsx    导出弹窗
```

### 跨域通信

各域之间只通过 ID 引用 + 查询接口通信，不共享内部实体：
- Digest → Studio：通过 digestItemId 引用（Draft 选素材时查询 Digest 域的数据）
- Digest → Analytics：DigestItem 被阅读时触发 UserEvent 写入
- Digest → Insight：DigestItem 数据供知识图谱分析

---

## 数据模型

### 新增表

#### drafts（内容草稿）

```
id: text PK
title: text              -- 草稿标题
platform: text           -- 'xhs' | 'twitter' | 'article'
content: text            -- Markdown 内容
status: text             -- 'draft' | 'final' | 'exported'
ai_prompt: text          -- 生成时用的 prompt（可溯源）
created_at: text
updated_at: text
```

#### draft_sources（草稿素材关联）

```
id: text PK
draft_id: text FK → drafts
digest_item_id: text FK → digest_items
sort_order: integer      -- 素材排序
created_at: text
```

多对多：一个草稿可引用多篇文章，一篇文章可被多个草稿引用。

#### share_cards（分享卡片）

```
id: text PK
draft_id: text FK → drafts        -- 可选，从草稿生成
digest_item_id: text FK            -- 可选，从单篇文章直接生成
template: text                     -- 卡片模板名
copy_text: text                    -- AI 生成的文案
image_path: text                   -- 渲染后的图片路径
created_at: text
```

两种入口：从草稿生成（完整文案卡片）或从单篇文章直接生成（快速分享）。draft_id 和 digest_item_id 至少有一个非空。

#### user_events（行为追踪）

```
id: text PK
event_type: text         -- 'read' | 'click' | 'favorite' | ...
target_type: text        -- 'digest_item' | 'draft' | ...
target_id: text
metadata: json           -- 扩展数据（滚动位置等）
created_at: text
```

通用事件表，Phase 1 就开始记录，Phase 3 统计仪表盘直接聚合。

### 后续 Phase 新增表（仅列出，到时详细设计）

- **Phase 2:** article_relations（文章关联关系）、topic_entities（话题实体）
- **Phase 3:** reading_stats（聚合统计）、reading_position（阅读位置）
- **Phase 4:** source_suggestions（推荐源记录）

---

## Phase 1：内容创作

### 用户工作流

1. **选素材** — 日报页勾选文章点「发送到工作台」，或在工作台内从收藏/历史中选取
2. **选平台 + 生成** — 选择目标平台（小红书/Twitter/公众号）→ AI 生成初稿 → 自动填入编辑器
3. **编辑微调** — Markdown 编辑器中修改内容
4. **输出** — 三条出路：复制 Markdown / 生成分享卡片 / 导出 HTML

### 工作台 UI

全屏编辑 + 可收起侧栏布局（方案 C）：
- 默认全屏 Markdown 编辑器，最大化写作空间
- 左侧素材面板可展开/收起，显示已选素材，支持从日报/收藏中追加
- 右侧预览面板可展开/收起，实时渲染 Markdown
- 顶部工具栏：平台切换（Tab 式）、生成按钮、输出操作

组件拆分要灵活，布局逻辑和业务逻辑分离，后期可调整布局方式。

### 日报页改动

- 文章卡片增加勾选框（多选模式）
- 底部浮动操作栏：选中 N 篇 → 「发送到工作台」按钮
- 跳转到 `/studio` 并携带选中的 digestItemId 列表

### 各平台 AI 生成策略

#### 小红书帖

- 内容结构：标题（带 emoji）+ 分段短句正文 + 3-5 个话题 tag + 封面建议
- 字数：300-800 字
- Zod schema 输出：`{ title, body, tags: string[], cover_suggestion }`

#### Twitter Thread

- 内容结构：Hook 推（抓注意力）+ 内容推（每条一个要点）+ 结尾推（总结 + CTA）
- 每条 ≤280 字，总计 3-10 条
- Zod schema 输出：`{ tweets: Array<{ index, content, char_count }> }`
- 编辑器中用 `---` 分隔每条推文，实时显示每条字数

#### 公众号文章

- 内容结构：标题 + 一句话摘要 + 小标题分段深度分析
- 字数：1000-3000 字
- Zod schema 输出：`{ title, abstract, body, sections: string[] }`

#### 生成流程（generator.ts）

1. 收集素材 — 根据 draft_sources 查询关联的 digest_items
2. 加载平台模板 — `platforms/xhs.ts` | `twitter.ts` | `article.ts`
3. 组装 prompt — 模板 + 素材内容 + 用户偏好（如有）
4. 调用 AI — `generateObject` + Zod schema，使用 quality 模型
5. 填入编辑器 — 格式化为 Markdown 写入 draft.content
6. 存储 prompt — 记录到 `draft.ai_prompt`，支持溯源和重新生成

### 分享卡片

- 渲染引擎：satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG)
- 卡片模板：React 组件，JSX 编写，支持多套模板
- 文案来源：AI 从草稿/文章内容中提炼精简文案
- 输出：PNG 图片，保存到 `data/cards/` 目录
- 扩展口：`CardRenderer` 接口，未来可替换为 AI 生图实现
- 两种入口：从工作台草稿生成 / 从日报单篇文章直接生成

### HTML 导出

- 将草稿内容渲染为带样式的 HTML
- 支持下载 `.html` 文件
- 未来可对接 Newsletter 发送服务

### 批处理工具函数（ai/batch.ts）

从 scoring.ts 和 summarize.ts 中提取通用模式：

```typescript
interface BatchOptions<T, R> {
  items: T[]
  batchSize: number
  concurrency: number
  process: (batch: T[]) => Promise<R[]>
  onProgress?: (done: number) => void
}

async function batchProcess<T, R>(opts: BatchOptions<T, R>): Promise<{
  results: R[]
  failedCount: number
}>
```

scoring.ts 和 summarize.ts 重构后从 ~50 行 → ~20 行，studio 各平台生成器直接复用。

### 现有代码迁移

- `src/lib/ai/scoring.ts` → `src/lib/digest/scoring.ts`
- `src/lib/ai/clustering.ts` → `src/lib/digest/clustering.ts`
- `src/lib/ai/summarize.ts` → `src/lib/digest/summarize.ts`
- `src/lib/ai/trends.ts` → `src/lib/digest/trends.ts`
- `src/lib/ai/preference.ts` → `src/lib/digest/preference.ts`
- `src/lib/pipeline.ts` → `src/lib/digest/pipeline.ts`
- `src/lib/collectors/` → `src/lib/digest/collectors/`
- `src/lib/ai/client.ts` → 保留在 `src/lib/ai/client.ts`
- `src/lib/ai/utils.ts` → 保留在 `src/lib/ai/utils.ts`

所有 import 路径同步更新。逻辑不变，只是按域重新组织。

---

## Phase 2：智能洞察

> 概要设计，到时详细展开。

### 知识图谱

- 在 pipeline 摘要阶段后加实体提取步骤（AI 任务）
- 提取实体类型：人物、公司、产品、技术
- 新增 `topic_entities` 表 + `article_relations` 表
- 前端用 d3-force 或 reactflow 可视化
- 新增页面 `/insights`

### 破圈预警

- 基于现有 clustering + trends 数据扩展
- 记录每个话题首次出现的源和时间
- 当话题跨越 2+ 源类型时触发预警
- 通过 Telegram 推送或日报页高亮

### 对比日报

- 基于现有聚类数据（cluster_id 相同的条目）
- AI 任务：输入同一 cluster 的多篇文章，输出观点对比摘要
- 在日报页的聚类卡片上加「查看对比」入口

---

## Phase 3：数据体验

> 概要设计，到时详细展开。

### 阅读统计仪表盘

- 聚合 user_events 表（Phase 1 已建）
- 按天/周/月维度聚合到 reading_stats 表
- 前端用 recharts 做可视化
- 新增页面 `/dashboard`
- 数据维度：阅读量（总/按源/按领域）、阅读时间分布、推荐命中率、趋势话题关注度

### 阅读位置记忆

- 前端 debounce 500ms 记录滚动位置
- localStorage 做一级缓存，DB 做持久化（reading_position 表）
- 页面加载时恢复位置
- 支持页面：日报页、收藏页、搜索结果页
- key 格式：页面路径 + 日期组合

---

## Phase 4：发现

> 概要设计，到时详细展开。

### RSS 源推荐/发现

- 维护 RSS 源目录（内置 + 社区贡献 + RSSHub 路由列表）
- AI 根据用户偏好画像 + 阅读历史匹配推荐
- 在设置页的源管理中加「发现」tab
- 一键添加到源列表

---

## 实施节奏

```
Phase 1（内容创作）→ review → Phase 2（智能洞察）→ review → Phase 3（数据体验）→ review → Phase 4（发现）
```

每个 Phase 完成后 review，确认方向再进入下一个 Phase。Phase 2-4 到时各自做详细设计。

---

## 技术选型（新增依赖）

| 依赖 | 用途 | Phase |
|------|------|-------|
| satori | JSX → SVG 渲染 | 1 |
| @resvg/resvg-js | SVG → PNG 转换 | 1 |
| @uiw/react-md-editor | Markdown 编辑器（轻量、内置预览、支持自定义工具栏） | 1 |
| recharts | 统计图表可视化 | 3 |
| d3-force 或 reactflow | 知识图谱可视化 | 2 |

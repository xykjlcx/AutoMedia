# 会话上下文交接文档（2026-04-06 下午）

## 项目基本信息

**项目名：** AutoMedia  
**路径：** `/Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia`  
**Remote：** `https://github.com/xykjlcx/AutoMedia.git`  
**当前分支：** `main`（未 push，本地领先 origin 约 20 个 commit）  
**最新 commit：** `d19b62f` 修复：摘要 prompt 强制中文输出  
**Dev server：** 运行中 `localhost:3000`

---

## 本次会话完成的全部工作（从今日凌晨到现在）

### 深夜自动交付（3 个 Spec，11 个 commit，洋哥已就寝）

通过"深度调研分析 → 迭代矩阵 → 用户决策 → 3 份 spec + 3 份 plan → 3 个 agent 串行实现"的流程，一夜交付 8 个功能：

| Spec | 子功能 | Commits |
|---|---|---|
| Spec 1 读-洞察升级 | B1 TL;DR + B2 稍后读 + C2 实体订阅 + C3 周洞察 | 4 |
| Spec 2 Studio 写作 | D2 版本历史 + D4 预览升级 + D5 配图生成 | 4 |
| Spec 3 Twitter 采集 | collector 多态派发 + 公开推文 + 私域架子 + 配置 UI | 3 |

### 上午调试和迭代（洋哥陪同验证，8 个 commit）

| Commit | 内容 |
|---|---|
| `cd3589b` | Twitter 私域 collector 对齐 agent-browser 真实 CLI（--auto-connect 分步命令） |
| `5e4020f` | 小红书私域采集（agent-browser + 推荐 feed 页） |
| `97aeffa` | RSS 每源上限 30 条截断（OpenAI Blog 903 条问题） |
| `410dae0` | 数据源默认 maxItems 从 5 调到 20 |
| `005dc72` | 耗时显示 bug + 左侧源名称 custom-xxx 问题 |
| `bec910d` + `9c84029` | 小红书链接 xsec_token 修复（a.cover 优先 + 保留参数） |
| `e465723` | 采集阶段源选择（点击生成 → 勾选源 → 开始） |
| `1564306` | 页面恢复 pipeline 时计时器不走 |
| `e84aa92` | 小红书 collector 逐条取正文（__INITIAL_STATE__ 取 desc） |
| `d19b62f` | 摘要 prompt 强制中文输出 |

---

## 当前技术状态

### 构建和测试
- `pnpm build` ✅ 通过
- `pnpm test` ✅ 18/18 通过（4 test files）
- 工作树 clean

### 数据库表（共 22+ 张）

**v3 新增 5 张：**
- `daily_tldrs` — 今日三件事（B1）
- `reading_queue` — 稍后读（B2）
- `entity_subscriptions` — 实体订阅（C2）
- `weekly_insights` — 每周洞察（C3）
- `draft_versions` — 草稿版本历史（D2）

**扩展字段：**
- `ai_settings` 追加 `image_provider` / `image_base_url` / `image_api_key` / `image_model`（D5）

### 源配置（source_configs 当前状态）

| ID | 名称 | Type | 启用 | maxItems |
|---|---|---|---|---|
| github | GitHub Trending | public | ✅ | 20 |
| 36kr | 36氪 | public | ✅ | 20 |
| zhihu | 知乎热榜 | public | ✅ | 20 |
| sspai | 少数派 | public | ✅ | 20 |
| hackernews | Hacker News | public | ✅ | 20 |
| twitter | Twitter | twitter-private | ✅ | 20 |
| xiaohongshu | 小红书 | xiaohongshu-private | ✅ | 20 |
| wechat | 公众号 | private | ✅ | 20 |
| custom-* | YC/MIT/Shopify/OpenAI/TechCrunch | custom-rss | ✅ | 20 |

### Collector 多态派发架构

```
src/lib/digest/collectors/
├── index.ts              ← pickCollector(sourceType) 派发器
├── rss.ts                ← public / custom-rss
├── twitter-public.ts     ← twitter-public（包装 RSS，走 RSSHub）
├── twitter-private.ts    ← twitter-private（agent-browser CLI）
├── xiaohongshu-private.ts ← xiaohongshu-private（agent-browser + 逐条取正文）
└── types.ts              ← CollectedItem / Collector 接口
```

`getPublicSources()` 返回所有有 collector 的源（包括 twitter-private 和 xiaohongshu-private）。

### Pipeline 改动
- `runDigestPipeline(date, sourceIds?)` — 支持只跑指定源
- 采集阶段：未选中的源进度显示"跳过"
- 末尾新增：Stage 4 TL;DR 生成 + 实体订阅推送

### 前端关键改动
- `DigestTrigger`：点击生成 → 展开源选择面板 → 勾选 → 开始采集
- `DigestPage`：动态加载源名称（覆盖 SOURCE_META）+ TL;DR 卡片
- `digest-card`：新增稍后读按钮
- `favorites/page`：Tabs 布局（收藏 | 稍后读）
- `insights/page`：顶部周洞察卡片 + 实体详情订阅按钮
- `studio-page`：版本历史 drawer + MarkdownPreview 替换正则渲染 + 配图按钮 + image Dialog
- `settings/page`：图片生成配置 Dialog + Twitter 源添加卡片

### 新增依赖（Spec 2）
- `react-markdown` `remark-gfm` `rehype-highlight` `highlight.js`

---

## 已验证通过

1. ✅ Pipeline 全链路（58 条 → AI 评分/聚类/摘要 → 53 条精选日报）
2. ✅ 小红书私域采集端到端（agent-browser → 列表页 → 逐条详情页取正文）
3. ✅ TL;DR 三件事卡片生成并展示
4. ✅ 源选择面板（只勾选小红书 → pipeline 只跑小红书）
5. ✅ 耗时显示（后端 timing.total + 恢复 pipeline 时 interval）
6. ✅ 左侧源名称正确显示
7. ✅ 摘要 prompt 强制中文

---

## 尚未验证 / 待完成

### 🔴 Twitter 私域（Chrome 未登录 x.com）
- 代码已就绪（`twitter-private.ts` 用 `--auto-connect` 分步命令）
- 需要洋哥在 Chrome 登录 x.com 后跑 `node scripts/twitter-smoke-test.mjs`
- 如果 CLI 参数需要调整，改 `twitter-private.ts` 里 `execFile` 参数

### 🟡 D5 图片生成（API key 未配置）
- Settings → 模型设置 → 「图片生成配置」Dialog
- 填入 Gemini 或 OpenAI 的 image API key
- 保存后 Studio 底部出现「配图」按钮
- Provider 支持：`google`（Gemini）/ `openai`（DALL-E / gpt-image-1）

### 🟡 未 push 到 origin
- 本地领先约 20 个 commit
- 洋哥确认后 `git push`

### 🟡 已知未修问题
- **小红书 xsec_token 过期**：链接几小时后失效，老日报里的小红书链接会 404。平台限制，暂无完美方案
- **小红书采集耗时长**：逐条取正文 ~3s/条，40 条约 2 分钟。可以考虑：只对标题初筛后的子集取正文（减少无关条目的导航）
- **Shopify Blog RSS 404**：`https://www.shopify.com/blog/feed` 返回 404，需要换 URL 或移除该源
- **知乎热榜偶发 503**：RSSHub 公共实例不稳定，可考虑自建 RSSHub 或换实例
- **公众号采集未实现**：seed 里 `wechat` 的 type 还是 legacy `private`，没有对应 collector

### 🟢 体验反馈待收集
- B2 稍后读：收藏页 Tab 切换体验
- C2 实体订阅：订阅按钮位置、Telegram 推送频率
- C3 周洞察：手动生成一次看质量
- D2 版本历史：drawer 交互
- 小红书正文质量：有了正文后 AI 评分/摘要是否更准

---

## 今晚迭代矩阵（已做 / 未做）

昨晚从 30+ 个候选里挑了 8 个方向，按优先级分组。以下是完成状态：

**✅ 首批（高价值低成本）已完成：**
- B1 TL;DR ✅ / B2 稍后读 ✅ / C2 实体订阅 ✅ / C3 周洞察 ✅

**✅ 重磅方向已完成：**
- A1 Twitter 采集 ✅（+ 额外做了小红书采集）

**✅ 顺带写作类已完成：**
- D2 版本历史 ✅ / D4 预览升级 ✅ / D5 配图生成 ✅

**❌ 昨晚矩阵里没选的（仍在候选池）：**
- E1 Obsidian 深度联动 / G3 Telegram 双向交互
- A3 Newsletter 收件箱采集 / G2 移动端 PWA
- G1 ⌘K 命令面板 / B5 键盘驱动
- C1 实体时间序列 / F1-F4 数据/消耗跟踪
- 技术债 T1-T4

---

## 架构关键点（供新会话快速上手）

1. **Collector 多态**：加新源只需新建 collector + 注册到 `index.ts` + `sources.ts` 过滤条件加入新 type
2. **Pipeline sourceIds**：trigger API 传 `sourceIds` 数组可只跑指定源
3. **agent-browser 采集模式**：`--auto-connect` 连真实 Chrome，分步命令（open → wait → scroll → eval），不支持一次传所有参数
4. **小红书正文**：详情页 `__INITIAL_STATE__.note.noteDetailMap[noteId].note.desc` 有全文，不需要 DOM 渲染
5. **xsec_token**：小红书链接必须带 `xsec_token` 参数否则 404，token 会过期（几小时）
6. **RSS 截断**：`rss.ts` 里 `slice(0, maxItems)`，maxItems 从 source_configs 表读取，默认 30
7. **摘要强制中文**：`summarize.ts` prompt 里明确"无论原文中英文都用中文撰写"
8. **双轨 schema**：runtime bootstrap（`db/index.ts`）+ Drizzle migration，DDL 必须 `IF NOT EXISTS`

---

## 文档索引

| 文件 | 内容 |
|---|---|
| `docs/日志/0406-三个spec一夜交付.md` | 晨报（完整交付总结） |
| `docs/superpowers/specs/2026-04-06-spec1-*.md` | Spec 1 设计文档 |
| `docs/superpowers/specs/2026-04-06-spec2-*.md` | Spec 2 设计文档 |
| `docs/superpowers/specs/2026-04-06-spec3-*.md` | Spec 3 设计文档 |
| `docs/superpowers/plans/2026-04-06-spec1-*.md` | Spec 1 实施计划 |
| `docs/superpowers/plans/2026-04-06-spec2-*.md` | Spec 2 实施计划 |
| `docs/superpowers/plans/2026-04-06-spec3-*.md` | Spec 3 实施计划 |
| `docs/twitter-setup.md` | Twitter 采集操作手册 |
| `scripts/twitter-smoke-test.mjs` | Twitter 私域验证脚本 |
| `docs/superpowers/specs/2026-04-06-iteration-matrix.md` | 完整迭代矩阵（30+ 候选方向 × 价值/成本/状态） |

---

## 下次会话快速开始

```bash
cd /Users/ocean/Studio/03-lab/02-vibe/08-AutoMedia
git log --oneline -5                    # 确认状态
lsof -iTCP:3000                         # 确认 dev server
# 如果要继续修 bug / 加功能：直接开干
# 如果要验证 Twitter：先 Chrome 登录 x.com，再 node scripts/twitter-smoke-test.mjs
# 如果要 push：git push
```

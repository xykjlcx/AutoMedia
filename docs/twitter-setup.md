# Twitter/X 采集通道设置指南

## 概述

AutoMedia 提供两路 Twitter 采集：

| 通道 | 说明 | 需要登录 | 配置方式 |
|---|---|---|---|
| **公开推文** | 特定 @username 的公开推文 | 否 | Settings → 信息源 → 添加 Twitter 源 → 公开用户 |
| **私域时间线** | 你 Following 的 feed | 是 | Settings → 信息源 → 添加 Twitter 源 → 我的时间线 |

## 公开推文（立即可用）

在 Settings 页面 → 信息源 → 「添加 Twitter 源」卡片：

1. 选「公开用户」
2. 输入 `@elonmusk`（不带 @ 也行）
3. 点「添加」

系统会自动通过 RSSHub 的 `/twitter/user/:username` 路由采集。无需额外配置。

## 私域时间线（需手动配置）

### 前置要求

1. **全局安装 agent-browser CLI**

   ```bash
   # 确认 agent-browser 命令可用
   which agent-browser
   agent-browser --help
   ```

   如果没有安装，参考 `~/.claude/guides/agent-browser.md`。

2. **Chrome 以 remote debugging 模式启动**

   ```bash
   # macOS
   open -a "Google Chrome" --args --remote-debugging-port=9222
   ```

   之后在这个 Chrome 里登录 [x.com](https://x.com) 并确认 `https://x.com/home` 能正常显示时间线。

3. **验证 agent-browser 能连接 Chrome**

   ```bash
   agent-browser --auto-connect --help
   ```

### 操作步骤

1. 启动 AutoMedia 开发服务器：`pnpm dev`
2. 打开 `/settings` → 信息源
3. 在「添加 Twitter 源」卡片切到「我的时间线」
4. 检查是否显示 "agent-browser CLI 可用" 绿色提示
5. 点「添加」（会创建一个固定 id 为 `twitter-feed` 的源）
6. 手动触发一次 pipeline：首页 → 生成今日日报
7. 观察 Twitter 源的采集状态（实时 SSE 日志）

### 故障诊断

如果采集失败，按顺序排查：

1. **跑验证脚本**

   ```bash
   node scripts/twitter-smoke-test.mjs
   ```

   脚本会输出具体失败原因。

2. **常见问题：**

   - **"command not found: agent-browser"** → CLI 未安装或 PATH 未包含
   - **"连接 Chrome 失败"** → Chrome 未以 debug 模式启动，或端口被占用
   - **"未解析出 tweets"** → X 的 DOM 结构可能变化，需要调整 `src/lib/digest/collectors/twitter-private.ts` 里的 `EXTRACT_SCRIPT`
   - **agent-browser 实际 CLI 参数不同** → 查看 `agent-browser --help`，对比 `twitter-private.ts` 里 `execFile` 传的参数，必要时调整

3. **CLI 参数不匹配的处理：**

   `twitter-private.ts` 里假设的命令格式是：

   ```bash
   agent-browser eval --url https://x.com/home --script '<js>' --json
   ```

   如果实际 agent-browser 的参数不同（比如用 `--eval` 代替 `--script`，或需要先 `open` 再 `eval`），修改 `twitter-private.ts` 的 `execFile` 调用即可。数据流和 parse 逻辑不用动。

   环境变量 `AGENT_BROWSER_CMD` 可覆盖默认命令名。

### 预期效果

配置成功后，每次 pipeline 触发会：

1. 连接 Chrome 里的 x.com 页面
2. 抓取时间线最新 30-40 条 tweets
3. 进入 AI 评分 → 聚类 → 摘要管线
4. 高分 tweets 出现在今日日报里，来源标记 Twitter 时间线

## 架构说明

- `src/lib/digest/collectors/twitter-public.ts` — 包装 RSS collector
- `src/lib/digest/collectors/twitter-private.ts` — 调用 agent-browser CLI
- `src/lib/digest/collectors/index.ts` — collector 多态派发
- `src/lib/digest/pipeline.ts` — 采集循环通过 `pickCollector(source.type)` 路由
- `src/app/api/sources/twitter/route.ts` — 快捷添加 API
- `src/app/api/sources/twitter/health/route.ts` — agent-browser CLI 健康检查
- `src/components/settings/twitter-source-adder.tsx` — Settings 页面 UI 卡片

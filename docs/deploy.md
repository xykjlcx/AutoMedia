# 部署指南

## Docker 部署（推荐）

### 前置要求
- Docker 20+
- Docker Compose v2+

### 快速启动

```bash
# 克隆仓库
git clone https://github.com/xykjlcx/AutoMedia.git
cd AutoMedia

# 启动
docker compose up -d

# 查看日志
docker compose logs -f
```

打开 http://localhost:3000，在设置页面配置 AI 模型后即可使用。

### 安全说明（必读）

AutoMedia 设计为**单用户本地工具**，所有 API 路由（包括草稿 CRUD）均无身份校验。因此：

- `docker-compose.yml` 默认将端口映射为 `127.0.0.1:3000:3000`，即容器只对宿主机 loopback 可达，**同局域网其他机器无法访问**。
- **切勿**把端口改成 `3000:3000` 或 `0.0.0.0:3000:3000`，否则任何能连到你这台机器的人都可以读写/删除你的草稿和数据库。
- 如需远程访问，请在前面加一层带认证的反向代理（Caddy/Nginx + Basic Auth）或使用 Tailscale 这类私有网络方案。
- 如果要真正改造成多用户服务，需要改 schema、queries、所有 API 路由，参见 `src/lib/studio/queries.ts` 顶部的设计说明。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_PATH` | SQLite 数据库路径 | `/app/data/automedia.db` |
| `RSSHUB_BASE_URL` | RSSHub 实例地址 | `https://rsshub.rssforever.com` |
| `ANTHROPIC_API_KEY` | Anthropic API Key（可选，也可在设置页配置） | - |
| `OPENAI_API_KEY` | OpenAI API Key（可选） | - |
| `APP_URL` | 应用 URL（用于 Telegram 通知链接） | `http://localhost:3000` |

### 数据持久化

数据库文件存储在 Docker volume `automedia-data` 中。备份数据：

```bash
docker compose cp automedia:/app/data/automedia.db ./backup.db
```

### 更新

```bash
git pull
docker compose up -d --build
```

## Node.js 部署

### 前置要求
- Node.js 20+
- pnpm 9+

### 步骤

```bash
# 安装依赖
pnpm install

# 数据库迁移
pnpm db:generate
pnpm db:migrate

# 构建
pnpm build

# 启动
pnpm start
```

### 使用 PM2 守护进程

```bash
npm install -g pm2
pm2 start pnpm --name automedia -- start
pm2 save
```

## Vercel 部署

> 注意：Vercel 的 serverless 环境不支持 SQLite 持久化存储。如需在 Vercel 部署，需要将数据库迁移至 Turso 或其他云端 SQLite 服务。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/xykjlcx/AutoMedia)

# AutoMedia 全面优化设计文档

## 目标
对 AutoMedia 进行四个阶段的全面优化：基础清理、数据层加固、SSE 实时进度、错误可见性。

## 阶段 1：基础清理
- `extractJson` 三份拷贝合并为 `src/lib/ai/utils.ts`，补齐 `{}` 模式
- 删除死代码：`filterTopItems`、`debug/rss`、`browser.ts` 空壳
- `getModels()` 加模块级缓存，settings POST 时清缓存
- `notify.ts` localhost 改读 `APP_URL` 环境变量
- API key mask 统一为 `first6***last4`

## 阶段 2：数据层加固
- 搜索 N+1 查询改为 `IN (...)` 批量
- `digest_items` 加 `digestDate`、`source` 索引（新迁移）
- Pipeline 写入包进 transaction
- `saveProgress` 回调 await
- Cron 表达式保存前校验

## 阶段 3：SSE 改造
- 新增 `src/lib/pipeline-events.ts`（EventEmitter 单例）
- Pipeline 进度更新时同时 emit 事件
- 新增 `GET /api/digest/stream` SSE 端点
- 前端 `digest-trigger.tsx` 改用 EventSource
- 保留旧 status 端点兼容

## 阶段 4：错误可见性
- AI 批次失败时记录失败条数到 progress
- Pipeline 异常兜底更新 DB 状态

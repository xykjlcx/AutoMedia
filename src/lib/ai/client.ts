import { anthropic } from '@ai-sdk/anthropic'

// 模型配置：按任务场景选择最优模型
// 后续可替换为其他 provider（openai、google、deepseek 等），业务代码不变
export const models = {
  // 评分筛选：要快、要便宜，批量处理
  fast: anthropic('claude-haiku-4-5-20251001'),
  // 摘要生成：质量优先
  quality: anthropic('claude-sonnet-4-6'),
} as const

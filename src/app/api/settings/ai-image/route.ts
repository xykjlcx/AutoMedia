import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { aiSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// 对 API Key 做脱敏展示
function mask(key: string): string {
  if (!key || key.length < 10) return key ? '***' : ''
  return `${key.slice(0, 6)}***${key.slice(-4)}`
}

// 获取图片生成配置（apiKey 脱敏）
export async function GET() {
  const row = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).get()
  if (!row) {
    return NextResponse.json({ provider: '', baseUrl: '', apiKey: '', model: '' })
  }
  return NextResponse.json({
    provider: row.imageProvider || '',
    baseUrl: row.imageBaseUrl || '',
    apiKey: mask(row.imageApiKey || ''),
    model: row.imageModel || '',
  })
}

// 更新图片生成配置
export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    provider?: string
    baseUrl?: string
    apiKey?: string
    model?: string
  }
  const now = new Date().toISOString()

  const existing = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).get()
  if (!existing) {
    // 创建默认行（provider 必须有值，先用 anthropic 作为占位的文本模型 provider）
    await db.insert(aiSettings).values({
      id: 'default',
      provider: 'anthropic',
      fastModel: 'claude-haiku-4-5-20251001',
      qualityModel: 'claude-sonnet-4-6',
      imageProvider: body.provider || '',
      imageBaseUrl: body.baseUrl || '',
      imageApiKey: body.apiKey || '',
      imageModel: body.model || '',
      updatedAt: now,
    })
  } else {
    // apiKey 包含 *** 说明是脱敏回显值，不覆盖原值
    const newKey = body.apiKey && !body.apiKey.includes('***') ? body.apiKey : existing.imageApiKey
    await db.update(aiSettings).set({
      imageProvider: body.provider ?? existing.imageProvider,
      imageBaseUrl: body.baseUrl ?? existing.imageBaseUrl,
      imageApiKey: newKey,
      imageModel: body.model ?? existing.imageModel,
      updatedAt: now,
    }).where(eq(aiSettings.id, 'default'))
  }

  return NextResponse.json({ success: true })
}

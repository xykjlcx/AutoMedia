import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { aiSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { clearModelCache } from '@/lib/ai/client'

export async function GET() {
  try {
    const rows = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).all()
    if (rows.length === 0) {
      // 返回默认配置（不暴露环境变量中的 key）
      return NextResponse.json({
        provider: 'anthropic',
        baseUrl: '',
        apiKey: '',
        fastModel: 'claude-haiku-4-5-20251001',
        qualityModel: 'claude-sonnet-4-6',
        hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
      })
    }
    const row = rows[0]
    return NextResponse.json({
      provider: row.provider,
      baseUrl: row.baseUrl || '',
      // API Key 脱敏：只返回前 8 位 + 后 4 位
      apiKey: maskKey(row.apiKey || ''),
      fastModel: row.fastModel,
      qualityModel: row.qualityModel,
      hasEnvKey: !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })
  } catch {
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json() as {
    provider: string
    baseUrl?: string
    apiKey?: string
    fastModel: string
    qualityModel: string
  }

  const now = new Date().toISOString()

  try {
    const existing = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).all()

    if (existing.length === 0) {
      await db.insert(aiSettings).values({
        id: 'default',
        provider: body.provider,
        baseUrl: body.baseUrl || '',
        apiKey: body.apiKey || '',
        fastModel: body.fastModel,
        qualityModel: body.qualityModel,
        updatedAt: now,
      })
    } else {
      // 如果传来的 apiKey 是脱敏格式（包含 ***），保留原始 key
      const newKey = body.apiKey && !body.apiKey.includes('***')
        ? body.apiKey
        : existing[0].apiKey

      await db.update(aiSettings).set({
        provider: body.provider,
        baseUrl: body.baseUrl || '',
        apiKey: newKey,
        fastModel: body.fastModel,
        qualityModel: body.qualityModel,
        updatedAt: now,
      }).where(eq(aiSettings.id, 'default'))
    }

    clearModelCache()
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function maskKey(key: string): string {
  if (!key || key.length < 12) return key ? '***' : ''
  return `${key.slice(0, 8)}***${key.slice(-4)}`
}

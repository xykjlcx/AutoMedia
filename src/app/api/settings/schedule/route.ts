import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { scheduleConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const rows = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()
  if (rows.length === 0) {
    return NextResponse.json({
      enabled: false,
      cronExpression: '0 6 * * *',
      telegramEnabled: false,
      telegramBotToken: '',
      telegramChatId: '',
    })
  }
  const row = rows[0]
  return NextResponse.json({
    enabled: row.enabled,
    cronExpression: row.cronExpression,
    telegramEnabled: row.telegramEnabled,
    telegramBotToken: row.telegramBotToken ? maskToken(row.telegramBotToken) : '',
    telegramChatId: row.telegramChatId,
  })
}

export async function POST(request: Request) {
  const body = await request.json() as {
    enabled?: boolean
    cronExpression?: string
    telegramEnabled?: boolean
    telegramBotToken?: string
    telegramChatId?: string
  }
  const now = new Date().toISOString()
  const existing = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()

  if (existing.length === 0) {
    await db.insert(scheduleConfig).values({
      id: 'default',
      enabled: body.enabled ?? false,
      cronExpression: body.cronExpression ?? '0 6 * * *',
      telegramEnabled: body.telegramEnabled ?? false,
      telegramBotToken: body.telegramBotToken ?? '',
      telegramChatId: body.telegramChatId ?? '',
      updatedAt: now,
    })
  } else {
    const updates: Record<string, unknown> = { updatedAt: now }
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.cronExpression !== undefined) updates.cronExpression = body.cronExpression
    if (body.telegramEnabled !== undefined) updates.telegramEnabled = body.telegramEnabled
    if (body.telegramBotToken !== undefined && !body.telegramBotToken.includes('***')) {
      updates.telegramBotToken = body.telegramBotToken
    }
    if (body.telegramChatId !== undefined) updates.telegramChatId = body.telegramChatId
    await db.update(scheduleConfig).set(updates).where(eq(scheduleConfig.id, 'default'))
  }
  return NextResponse.json({ success: true })
}

function maskToken(token: string): string {
  if (token.length < 10) return '***'
  return token.slice(0, 6) + '***' + token.slice(-4)
}

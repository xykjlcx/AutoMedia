import { db } from './db/index'
import { scheduleConfig } from './db/schema'
import { eq } from 'drizzle-orm'
import type { CrossSourceAlert } from './digest/cross-source-alert'
import type { SubscriptionMatch } from './insights/entity-subscription'

export async function sendDigestNotification(date: string, itemCount: number) {
  try {
    const rows = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()
    if (rows.length === 0) return

    const config = rows[0]
    if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) return

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const message = `📰 AutoMedia 日报已就绪\n\n📅 日期：${date}\n📊 共 ${itemCount} 条精选\n\n🔗 查看日报：${appUrl}/?date=${date}`

    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
      }),
    })
  } catch (err) {
    console.error('[notify] Telegram 推送失败:', err)
  }
}

// 推送破圈预警：话题首次跨源扩散时通知
export async function sendCrossSourceAlerts(alerts: CrossSourceAlert[]) {
  try {
    const rows = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()
    if (rows.length === 0) return

    const config = rows[0]
    if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) return

    if (alerts.length === 0) return

    // 过滤：只推送今天首次识别出跨源的话题（daysSinceFirstSeen <= 1）
    // 并且跨源数 >= 2（detectCrossSourceAlerts 已过滤，此处双重保险）
    const toNotify = alerts.filter(a =>
      a.daysSinceFirstSeen <= 1 && a.sources.length >= 2
    )

    if (toNotify.length === 0) return

    const appUrl = process.env.APP_URL || 'http://localhost:3000'

    // 最多推送 Top 5，避免刷屏
    const top = toNotify.slice(0, 5)
    const typeLabels: Record<string, string> = {
      person: '人物',
      company: '公司',
      product: '产品',
      technology: '技术',
    }

    const lines = [
      '🚨 破圈话题预警',
      '',
      `检测到 ${toNotify.length} 个话题正在跨源扩散：`,
      '',
    ]

    for (const alert of top) {
      const label = typeLabels[alert.entityType] || alert.entityType
      lines.push(`▸ ${alert.entityName} (${label})`)
      lines.push(`  扩散路径: ${alert.spreadPath}`)
      lines.push(`  提及 ${alert.mentionCount} 次 · 覆盖 ${alert.sources.length} 个源`)
      lines.push('')
    }

    lines.push(`🔗 查看详情: ${appUrl}/insights`)

    const message = lines.join('\n')

    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
      }),
    })
  } catch (err) {
    console.error('[notify] 破圈预警推送失败:', err)
  }
}

// 实体订阅推送：订阅的实体在当天出现时通知
const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: '人物',
  company: '公司',
  product: '产品',
  technology: '技术',
}

export async function sendEntityAlerts(matches: SubscriptionMatch[]) {
  if (matches.length === 0) return
  try {
    const rows = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()
    if (rows.length === 0) return
    const config = rows[0]
    if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) return

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const lines: string[] = ['🔔 你关注的话题出现了', '']

    for (const m of matches.slice(0, 5)) {
      const label = ENTITY_TYPE_LABELS[m.entityType] || m.entityType
      lines.push(`▸ ${m.entityName} (${label})`)
      lines.push(`  ${m.newArticles.length} 篇新文章`)
      if (m.newArticles[0]) {
        lines.push(`  · ${m.newArticles[0].title.slice(0, 40)}`)
      }
      lines.push('')
    }
    lines.push(`🔗 详情：${appUrl}/insights`)

    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text: lines.join('\n') }),
    })
  } catch (err) {
    console.error('[notify] 实体订阅推送失败:', err)
  }
}

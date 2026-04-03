import { db } from './db/index'
import { scheduleConfig } from './db/schema'
import { eq } from 'drizzle-orm'

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

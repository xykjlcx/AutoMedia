import { schedule as cronSchedule, validate as cronValidate, type ScheduledTask } from 'node-cron'
import { db } from './db/index'
import { scheduleConfig } from './db/schema'
import { eq } from 'drizzle-orm'
import { runDigestPipeline, isDigestRunning } from './pipeline'

let currentJob: ScheduledTask | null = null

function getScheduleConfig() {
  try {
    const rows = db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 'default')).all()
    return rows[0] || null
  } catch {
    return null
  }
}

export function startScheduler() {
  stopScheduler()
  const config = getScheduleConfig()
  if (!config?.enabled || !config.cronExpression) {
    console.log('[scheduler] 定时任务未启用')
    return
  }

  if (!cronValidate(config.cronExpression)) {
    console.error('[scheduler] 无效的 cron 表达式:', config.cronExpression)
    return
  }

  currentJob = cronSchedule(config.cronExpression, async () => {
    const today = new Date().toISOString().slice(0, 10)
    console.log(`[scheduler] 定时触发日报生成: ${today}`)

    try {
      if (await isDigestRunning(today)) {
        console.log('[scheduler] 日报正在生成中，跳过')
        return
      }
      await runDigestPipeline(today)
    } catch (err) {
      console.error('[scheduler] 定时生成失败:', err)
    }
  })

  console.log(`[scheduler] 定时任务已启动: ${config.cronExpression}`)
}

export function stopScheduler() {
  if (currentJob) {
    currentJob.stop()
    currentJob = null
    console.log('[scheduler] 定时任务已停止')
  }
}

export function restartScheduler() {
  stopScheduler()
  startScheduler()
}

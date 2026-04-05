"use client"

// 轻量的事件上报函数 — 客户端调用，失败静默
export async function trackEvent(
  eventType: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, targetType, targetId, metadata }),
    })
  } catch {
    // 静默失败 — 埋点不能影响主流程
  }
}

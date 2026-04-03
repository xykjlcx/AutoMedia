export async function register() {
  // 只在 Node.js 运行时启动（不在 Edge runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}

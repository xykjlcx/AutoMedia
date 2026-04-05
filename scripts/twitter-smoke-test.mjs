#!/usr/bin/env node
// Twitter 私域时间线采集验证脚本
// 验证 agent-browser CLI 能否拉到登录后的 x.com 时间线
// 用法：node scripts/twitter-smoke-test.mjs

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'

const EXTRACT_SCRIPT = `
(async () => {
  await new Promise(r => setTimeout(r, 2500));
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];
  for (const art of Array.from(articles).slice(0, 10)) {
    try {
      const textEl = art.querySelector('[data-testid="tweetText"]');
      const authorEl = art.querySelector('[data-testid="User-Name"] a[role="link"]');
      const linkEl = art.querySelector('a[href*="/status/"]');
      if (!textEl || !linkEl) continue;
      tweets.push({
        text: (textEl.textContent || '').slice(0, 80),
        author: authorEl ? (authorEl.textContent || '') : '',
        url: linkEl.href || linkEl.getAttribute('href'),
      });
    } catch {}
  }
  return tweets;
})()
`.trim()

async function main() {
  console.log('[smoke-test] 检查 agent-browser CLI...')
  try {
    const { stdout } = await execFileAsync(AGENT_BROWSER_CMD, ['--help'], { timeout: 5000 })
    console.log('[smoke-test] CLI 可用')
    console.log(stdout.slice(0, 200))
  } catch (err) {
    console.error('[smoke-test] CLI 调用失败:', err.message)
    console.error('[smoke-test] 提示：确认 agent-browser 已全局安装，PATH 里能找到')
    process.exit(1)
  }

  console.log('\n[smoke-test] 尝试连接 Chrome 并访问 x.com/home...')
  try {
    const { stdout } = await execFileAsync(
      AGENT_BROWSER_CMD,
      ['eval', '--url', 'https://x.com/home', '--script', EXTRACT_SCRIPT, '--json'],
      { timeout: 60000 }
    )
    console.log('[smoke-test] agent-browser 原始输出（前 2000 字符）：')
    console.log(stdout.slice(0, 2000))

    // 尝试 parse
    let tweets = []
    try {
      tweets = JSON.parse(stdout.trim())
    } catch {
      const match = stdout.match(/\[[\s\S]*\]/)
      if (match) {
        try { tweets = JSON.parse(match[0]) } catch {}
      }
    }

    if (!Array.isArray(tweets)) tweets = []

    console.log(`\n[smoke-test] 解析出 ${tweets.length} 条 tweets`)
    for (const t of tweets.slice(0, 3)) {
      console.log(`  - ${t.author}: ${t.text?.slice(0, 50)}`)
    }

    if (tweets.length === 0) {
      console.warn('[smoke-test] 警告：未解析出 tweets，可能原因：')
      console.warn('  1. agent-browser CLI 参数与脚本假设不一致（查看 agent-browser --help）')
      console.warn('  2. X 的 DOM 结构变化，需调整 EXTRACT_SCRIPT 的选择器')
      console.warn('  3. Chrome 里未登录 x.com')
      console.warn('  代码位置：src/lib/digest/collectors/twitter-private.ts')
    } else {
      console.log('[smoke-test] 成功拉取时间线')
    }
  } catch (err) {
    console.error('[smoke-test] 采集失败:', err.message)
    console.error('[smoke-test] 常见原因：')
    console.error('  1. Chrome 未启动或未开启 remote debugging (--remote-debugging-port=9222)')
    console.error('  2. 未登录 x.com')
    console.error('  3. agent-browser CLI 参数与代码不匹配（真实参数请 agent-browser --help 查看）')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[smoke-test] 致命错误:', err)
  process.exit(1)
})

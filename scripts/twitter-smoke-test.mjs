#!/usr/bin/env node
// Twitter 私域时间线采集验证脚本
// 验证 agent-browser --auto-connect 能否拉到登录后的 x.com 时间线
// 前提：Chrome 已运行且已登录 x.com
// 用法：node scripts/twitter-smoke-test.mjs

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const BASE = ['--auto-connect']

async function ab(...args) {
  const { stdout } = await execFileAsync(CMD, [...BASE, ...args], { timeout: 30000 })
  return stdout
}

const EXTRACT_SCRIPT = `
(() => {
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
  return JSON.stringify(tweets);
})()
`.replace(/\n/g, ' ').trim()

async function main() {
  // Step 1: 检查 CLI
  console.log('[smoke-test] 检查 agent-browser CLI...')
  try {
    await ab('--version')
    console.log('[smoke-test] ✅ CLI 可用')
  } catch (err) {
    console.error('[smoke-test] ❌ CLI 不可用:', err.message)
    process.exit(1)
  }

  // Step 2: 导航到时间线
  console.log('\n[smoke-test] 打开 x.com/home...')
  try {
    await ab('open', 'https://x.com/home')
    console.log('[smoke-test] ✅ 页面已打开')
  } catch (err) {
    console.error('[smoke-test] ❌ 打开页面失败:', err.message)
    console.error('  请确认 Chrome 已运行且已登录 x.com')
    process.exit(1)
  }

  // Step 3: 等待 tweet 元素出现
  console.log('[smoke-test] 等待 tweets 加载...')
  try {
    await ab('wait', 'article[data-testid="tweet"]')
    console.log('[smoke-test] ✅ tweets 已出现')
  } catch (err) {
    console.error('[smoke-test] ❌ 未等到 tweets:', err.message)
    console.error('  可能原因：未登录 / 时间线为空 / DOM 选择器变化')
    process.exit(1)
  }

  // Step 4: 执行 JS 提取
  console.log('[smoke-test] 执行 JS 提取 tweets...')
  try {
    const stdout = await ab('--json', 'eval', EXTRACT_SCRIPT)
    console.log('[smoke-test] 原始输出（前 1000 字符）：')
    console.log(stdout.slice(0, 1000))

    // 尝试 parse
    let tweets = []
    try {
      const parsed = JSON.parse(stdout.trim())
      if (Array.isArray(parsed)) tweets = parsed
      else if (parsed?.result) {
        const inner = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result
        if (Array.isArray(inner)) tweets = inner
      }
    } catch {
      const match = stdout.match(/\[[\s\S]*\]/)
      if (match) try { tweets = JSON.parse(match[0]) } catch {}
    }

    console.log(`\n[smoke-test] 解析出 ${tweets.length} 条 tweets`)
    for (const t of tweets.slice(0, 5)) {
      console.log(`  🐦 ${t.author}: ${t.text}`)
    }

    if (tweets.length === 0) {
      console.warn('\n[smoke-test] ⚠️ 未解析出 tweets。可能原因：')
      console.warn('  - eval 返回格式不符预期，查看上面的原始输出')
      console.warn('  - DOM 选择器 article[data-testid="tweet"] 已变化')
    } else {
      console.log('\n[smoke-test] ✅ 全部通过！私域时间线采集链路正常')
    }
  } catch (err) {
    console.error('[smoke-test] ❌ eval 执行失败:', err.message)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[smoke-test] 致命错误:', err)
  process.exit(1)
})

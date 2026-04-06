import { execFile } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectedItem } from './types'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const TIMELINE_URL = 'https://x.com/home'
const TIMEOUT_MS = 60000

// agent-browser 通用参数：--auto-connect 连接运行中的真实 Chrome
const AB_BASE_ARGS = ['--auto-connect']

// 浏览器端脚本：提取时间线 tweets
const EXTRACT_SCRIPT = `
(() => {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];
  for (const art of Array.from(articles).slice(0, 40)) {
    try {
      const textEl = art.querySelector('[data-testid="tweetText"]');
      const authorEl = art.querySelector('[data-testid="User-Name"] a[role="link"]');
      const linkEl = art.querySelector('a[href*="/status/"]');
      if (!textEl || !linkEl) continue;
      const url = linkEl.href.startsWith('http') ? linkEl.href : 'https://x.com' + linkEl.getAttribute('href');
      tweets.push({
        text: (textEl.textContent || '').trim(),
        author: authorEl ? (authorEl.textContent || '').trim() : '',
        url,
      });
    } catch {}
  }
  return JSON.stringify(tweets);
})()
`.replace(/\n/g, ' ').trim()

// 解析 agent-browser --json eval 的 stdout
function parseAgentBrowserOutput(stdout: string): Array<{ text: string; author: string; url: string }> {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  // --json 模式下，eval 返回的是 JSON 对象
  try {
    const parsed = JSON.parse(trimmed)
    // eval 的结果可能直接是数组，也可能在 .result 里
    if (Array.isArray(parsed)) return parsed
    if (parsed?.result && typeof parsed.result === 'string') {
      const inner = JSON.parse(parsed.result)
      if (Array.isArray(inner)) return inner
    }
    if (parsed?.result && Array.isArray(parsed.result)) return parsed.result
  } catch {
    // 非标准 JSON
  }

  // Fallback：从 stdout 里提取 JSON 数组
  const match = trimmed.match(/\[[\s\S]*\]/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* ignore */ }
  }
  return []
}

// 执行一条 agent-browser 命令
async function ab(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    AGENT_BROWSER_CMD,
    [...AB_BASE_ARGS, ...args],
    { timeout: TIMEOUT_MS }
  )
  return stdout
}

export const twitterPrivateCollector: Collector = {
  name: 'twitter-private',

  async collect(sourceId, _config): Promise<CollectedItem[]> {
    try {
      // Step 1: 导航到时间线（如果已在该页面则跳过也无妨）
      await ab('open', TIMELINE_URL)

      // Step 2: 等待页面加载（等 tweet 元素出现，最长 10s）
      await ab('wait', 'article[data-testid="tweet"]')

      // Step 3: 向下滚动一次加载更多内容
      await ab('scroll', 'down', '800')
      await ab('wait', '1500')

      // Step 4: 执行 JS 提取 tweets
      const stdout = await ab('--json', 'eval', EXTRACT_SCRIPT)

      const parsed = parseAgentBrowserOutput(stdout)
      const items: CollectedItem[] = parsed
        .filter(t => t?.text && t?.url)
        .map(t => ({
          source: sourceId,
          sourceType: 'private' as const,
          title: t.text.slice(0, 120),
          content: t.text,
          url: t.url,
          author: t.author || '',
        }))

      return items
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Twitter 私域采集失败：${msg}。请确认 (1) Chrome 已运行且已登录 x.com；(2) agent-browser CLI 已安装（npm i -g agent-browser）。详见 docs/twitter-setup.md`
      )
    }
  },
}

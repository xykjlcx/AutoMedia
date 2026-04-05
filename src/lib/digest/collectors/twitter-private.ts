import { execFile } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectedItem } from './types'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const TIMELINE_URL = 'https://x.com/home'
const TIMEOUT_MS = 60000

// 提取时间线 tweets 的浏览器端脚本
const EXTRACT_SCRIPT = `
(async () => {
  await new Promise(r => setTimeout(r, 2500));
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
  return tweets;
})()
`.trim()

// 解析 agent-browser stdout：支持 JSON 或纯文本 fallback
function parseAgentBrowserOutput(stdout: string): Array<{ text: string; author: string; url: string }> {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  // 尝试 JSON 解析（首选路径）
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
    // 有时 agent-browser 包装在 { result: [...] } 里
    if (parsed?.result && Array.isArray(parsed.result)) return parsed.result
  } catch {
    // 非 JSON，fallthrough
  }

  // Fallback：尝试从 stdout 里提取 JSON 数组（有些 CLI 会在前后加 log）
  const match = trimmed.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {
      // ignore
    }
  }
  return []
}

export const twitterPrivateCollector: Collector = {
  name: 'twitter-private',

  async collect(sourceId, _config): Promise<CollectedItem[]> {
    try {
      const { stdout } = await execFileAsync(
        AGENT_BROWSER_CMD,
        ['eval', '--url', TIMELINE_URL, '--script', EXTRACT_SCRIPT, '--json'],
        { timeout: TIMEOUT_MS }
      )

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
        `Twitter 私域采集失败：${msg}。请确认 (1) Chrome 已启动并开启 remote debugging；(2) 已登录 x.com；(3) agent-browser CLI 已安装。详见 docs/twitter-setup.md`
      )
    }
  },
}

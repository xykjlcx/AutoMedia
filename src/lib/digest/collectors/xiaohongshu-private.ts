import { execFile } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectedItem } from './types'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const EXPLORE_URL = 'https://www.xiaohongshu.com/explore'
const TIMEOUT_MS = 60000

// agent-browser 通用参数
const AB_BASE_ARGS = ['--auto-connect']

// 浏览器端脚本：提取推荐 feed 笔记
const EXTRACT_SCRIPT = `
(() => {
  const items = document.querySelectorAll('section.note-item');
  const notes = [];
  for (const item of Array.from(items).slice(0, 40)) {
    try {
      const titleEl = item.querySelector('a.title span') || item.querySelector('.title span');
      const authorEl = item.querySelector('span.name') || item.querySelector('.author-wrapper .name');
      const linkEl = item.querySelector('a.cover[href*="/explore/"]') || item.querySelector('a.cover');
      if (!titleEl || !linkEl) continue;
      const href = linkEl.getAttribute('href') || '';
      const url = href.startsWith('http') ? href : 'https://www.xiaohongshu.com' + href;
      notes.push({
        title: (titleEl.textContent || '').trim(),
        author: authorEl ? (authorEl.textContent || '').trim() : '',
        url,
      });
    } catch {}
  }
  return JSON.stringify(notes);
})()
`.replace(/\n/g, ' ').trim()

// 解析 agent-browser --json eval 的 stdout
function parseOutput(stdout: string): Array<{ title: string; author: string; url: string }> {
  const trimmed = stdout.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
    if (parsed?.data?.result) {
      const inner = typeof parsed.data.result === 'string' ? JSON.parse(parsed.data.result) : parsed.data.result
      if (Array.isArray(inner)) return inner
    }
    if (parsed?.result) {
      const inner = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result
      if (Array.isArray(inner)) return inner
    }
  } catch { /* fallthrough */ }
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

export const xiaohongshuPrivateCollector: Collector = {
  name: 'xiaohongshu-private',

  async collect(sourceId, _config): Promise<CollectedItem[]> {
    try {
      // Step 1: 导航到推荐 feed
      await ab('open', EXPLORE_URL)

      // Step 2: 等待笔记元素出现
      await ab('wait', 'section.note-item')

      // Step 3: 滚动加载更多
      await ab('scroll', 'down', '1000')
      await ab('wait', '1500')
      await ab('scroll', 'down', '800')
      await ab('wait', '1000')

      // Step 4: 执行 JS 提取笔记
      const stdout = await ab('--json', 'eval', EXTRACT_SCRIPT)

      const parsed = parseOutput(stdout)
      const items: CollectedItem[] = parsed
        .filter(n => n?.title && n?.url)
        .map(n => ({
          source: sourceId,
          sourceType: 'private' as const,
          title: n.title,
          content: n.title, // 列表页只有标题，正文需点开（采集效率考虑不点开）
          url: n.url,
          author: n.author || '',
        }))

      return items
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `小红书采集失败：${msg}。请确认 (1) Chrome 已运行且已登录小红书；(2) agent-browser CLI 已安装。`
      )
    }
  },
}

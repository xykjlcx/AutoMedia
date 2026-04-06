import { execFile } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectedItem } from './types'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'
const EXPLORE_URL = 'https://www.xiaohongshu.com/explore'
const TIMEOUT_MS = 180000 // 3 分钟总超时（含逐条取正文）

// agent-browser 通用参数
const AB_BASE_ARGS = ['--auto-connect']

// 浏览器端脚本：提取推荐 feed 笔记标题 + URL
const LIST_SCRIPT = `
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

// 详情页脚本：从 __INITIAL_STATE__ 提取正文
const DETAIL_SCRIPT = `
(() => {
  const map = window.__INITIAL_STATE__?.note?.noteDetailMap;
  if (!map) return JSON.stringify({ desc: '', tags: [] });
  for (const id in map) {
    const n = map[id]?.note;
    if (!n) continue;
    return JSON.stringify({
      desc: n.desc || '',
      tags: (n.tagList || []).map(t => t.name || '').filter(Boolean),
      type: n.type || '',
    });
  }
  return JSON.stringify({ desc: '', tags: [] });
})()
`.replace(/\n/g, ' ').trim()

// 解析 agent-browser --json eval 的 stdout
function parseOutput<T>(stdout: string): T | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed?.data?.result) {
      return typeof parsed.data.result === 'string' ? JSON.parse(parsed.data.result) : parsed.data.result
    }
    if (parsed?.result) {
      return typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result
    }
    return parsed
  } catch { /* fallthrough */ }
  const match = trimmed.match(/[\[{][\s\S]*[\]}]/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* ignore */ }
  }
  return null
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

interface NoteListItem {
  title: string
  author: string
  url: string
}

interface NoteDetail {
  desc: string
  tags: string[]
  type: string
}

export const xiaohongshuPrivateCollector: Collector = {
  name: 'xiaohongshu-private',

  async collect(sourceId, _config): Promise<CollectedItem[]> {
    try {
      // ── Phase 1: 列表页采集标题 + URL ──
      await ab('open', EXPLORE_URL)
      await ab('wait', 'section.note-item')
      await ab('scroll', 'down', '1000')
      await ab('wait', '1500')
      await ab('scroll', 'down', '800')
      await ab('wait', '1000')

      const listStdout = await ab('--json', 'eval', LIST_SCRIPT)
      const noteList = parseOutput<NoteListItem[]>(listStdout) || []

      if (noteList.length === 0) return []
      console.log(`[xiaohongshu] 列表页拿到 ${noteList.length} 条标题，开始取正文...`)

      // ── Phase 2: 逐条导航详情页取正文 ──
      // 从 SSR __INITIAL_STATE__ 取数据，不需要等 DOM 渲染，每条 ~2-3 秒
      const items: CollectedItem[] = []

      for (const note of noteList) {
        try {
          await ab('open', note.url)
          // 不需要 wait DOM，__INITIAL_STATE__ 在 HTML 里直接可用
          const detailStdout = await ab('--json', 'eval', DETAIL_SCRIPT)
          const detail = parseOutput<NoteDetail>(detailStdout)

          const content = detail?.desc || note.title
          const tags = detail?.tags || []

          items.push({
            source: sourceId,
            sourceType: 'private' as const,
            title: note.title,
            content: tags.length > 0
              ? `${content}\n\n标签：${tags.join('、')}`
              : content,
            url: note.url,
            author: note.author || '',
          })
        } catch (err) {
          // 单条失败不影响整体，跳过
          console.warn(`[xiaohongshu] 取正文失败: ${note.title.slice(0, 30)}`, err)
          items.push({
            source: sourceId,
            sourceType: 'private' as const,
            title: note.title,
            content: note.title,
            url: note.url,
            author: note.author || '',
          })
        }
      }

      console.log(`[xiaohongshu] 采集完成：${items.length} 条（${items.filter(i => i.content !== i.title).length} 条有正文）`)
      return items
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `小红书采集失败：${msg}。请确认 (1) Chrome 已运行且已登录小红书；(2) agent-browser CLI 已安装。`
      )
    }
  },
}

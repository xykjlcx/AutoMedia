import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const AGENT_BROWSER_CMD = process.env.AGENT_BROWSER_CMD || 'agent-browser'

// GET /api/sources/twitter/health
// 检查 agent-browser CLI 是否可用（供 UI 实时显示绿/红状态）
export async function GET() {
  try {
    // 尝试调用 --help 或 --version 测试 CLI 存在性
    const { stdout } = await execFileAsync(AGENT_BROWSER_CMD, ['--version'], { timeout: 5000 })
    return NextResponse.json({
      cliAvailable: true,
      cliOutput: stdout.slice(0, 200),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      cliAvailable: false,
      error: msg,
      hint: '需要全局安装 agent-browser CLI（见 docs/twitter-setup.md）',
    })
  }
}

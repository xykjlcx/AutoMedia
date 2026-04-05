import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import type { ReactNode } from 'react'

const CARDS_DIR = join(process.cwd(), 'data', 'cards')

// 确保卡片目录存在
if (!existsSync(CARDS_DIR)) {
  mkdirSync(CARDS_DIR, { recursive: true })
}

// 字体候选清单（优先级从高到低），satori 不支持 variable font/TTC，必须是静态单权重 TTF/OTF
const FONT_CANDIDATES = [
  'SourceHanSansSC-Regular.otf', // Adobe Source Han Sans SC (静态 OTF，推荐)
  'NotoSansSC-Regular.otf',       // Google Noto Sans SC 静态 OTF
  'NotoSansSC-Regular.ttf',       // 兜底（如果是静态 TTF）
]

function getFontPath(): string {
  for (const name of FONT_CANDIDATES) {
    const fontPath = join(process.cwd(), 'public', 'fonts', name)
    if (existsSync(fontPath)) return fontPath
  }
  throw new Error(
    '未找到可用的静态中文字体。请将以下任一字体放到 public/fonts/：\n' +
    '- SourceHanSansSC-Regular.otf（推荐，可从 Adobe Source Han Sans 下载）\n' +
    '- NotoSansSC-Regular.otf（静态版）\n' +
    '注意：satori 不支持 variable font 和 TTC 格式'
  )
}

// 加载字体二进制数据给 satori 使用
function loadFont(): ArrayBuffer {
  return readFileSync(getFontPath()).buffer as ArrayBuffer
}

export interface CardInput {
  title: string
  summary: string
  source?: string
  date?: string
  brandName?: string
}

// CardRenderer 接口 — 预留 AI 生图扩展口
export interface CardRenderer {
  render(input: CardInput): Promise<string>
}

export const satoriRenderer: CardRenderer = {
  async render(input: CardInput): Promise<string> {
    const { title, summary, source, date, brandName = 'AutoMedia' } = input
    const font = loadFont()

    // satori 使用纯对象而非 JSX，结构为 { type, props: { style, children } }
    const element = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          padding: '48px',
          fontFamily: 'Chinese Sans',
          color: '#fff',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { color: '#e94560', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' },
              children: `${brandName} · 每日精选`,
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', lineHeight: 1.4 },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: '16px', color: '#aaa', lineHeight: 1.8, flex: 1 },
              children: summary.slice(0, 200) + (summary.length > 200 ? '...' : ''),
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#555',
                marginTop: '24px',
              },
              children: [
                { type: 'span', props: { children: date || new Date().toISOString().slice(0, 10) } },
                { type: 'span', props: { children: source || brandName } },
              ],
            },
          },
        ],
      },
    } as unknown as ReactNode

    const svg = await satori(element, {
      width: 800,
      height: 450,
      fonts: [{
        name: 'Chinese Sans',
        data: font,
        weight: 400,
        style: 'normal',
      }],
    })

    // 显式指定字体，禁用系统字体扫描，避免 resvg 误加载 macOS 的 TTC 文件报错
    const resvg = new Resvg(svg, {
      font: {
        loadSystemFonts: false,
        fontFiles: [getFontPath()],
      },
    })
    const pngBuffer = resvg.render().asPng()

    const filename = `${uuid()}.png`
    const filepath = join(CARDS_DIR, filename)
    writeFileSync(filepath, pngBuffer)

    return filepath
  },
}

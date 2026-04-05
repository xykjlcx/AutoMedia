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

// 加载字体（优先 public/fonts/，其次系统字体）
function loadFont(): ArrayBuffer {
  const fontPath = join(process.cwd(), 'public', 'fonts', 'NotoSansSC-Regular.ttf')
  if (existsSync(fontPath)) {
    return readFileSync(fontPath).buffer as ArrayBuffer
  }
  const systemFonts = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
  ]
  for (const f of systemFonts) {
    if (existsSync(f)) return readFileSync(f).buffer as ArrayBuffer
  }
  throw new Error('未找到可用的中文字体，请将 NotoSansSC-Regular.ttf 放到 public/fonts/')
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
          fontFamily: 'Noto Sans SC',
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
        name: 'Noto Sans SC',
        data: font,
        weight: 400,
        style: 'normal',
      }],
    })

    const resvg = new Resvg(svg)
    const pngBuffer = resvg.render().asPng()

    const filename = `${uuid()}.png`
    const filepath = join(CARDS_DIR, filename)
    writeFileSync(filepath, pngBuffer)

    return filepath
  },
}

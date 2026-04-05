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

// 模板定义 — 每个模板负责构造 satori element tree
export interface CardTemplate {
  id: string
  name: string
  description: string
  build: (input: CardInput) => any
}

// CardRenderer 接口 — 预留 AI 生图扩展口
export interface CardRenderer {
  render(input: CardInput, templateId?: string): Promise<string>
}

// ============================================================
// 公共辅助：摘要截断
// ============================================================
function truncateSummary(summary: string, max = 200): string {
  return summary.length > max ? summary.slice(0, max) + '...' : summary
}

function getDate(date?: string): string {
  return date || new Date().toISOString().slice(0, 10)
}

// ============================================================
// Template 1: 深色渐变 dark-gradient（原默认模板）
// ============================================================
function buildDarkGradient(input: CardInput): any {
  const { title, summary, source, date, brandName = 'AutoMedia' } = input
  return {
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
            style: { fontSize: '16px', color: '#aaa', lineHeight: 1.8, flex: 1, display: 'flex' },
            children: truncateSummary(summary),
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#888',
              marginTop: '24px',
            },
            children: [
              { type: 'span', props: { children: getDate(date) } },
              { type: 'span', props: { children: source || brandName } },
            ],
          },
        },
      ],
    },
  }
}

// ============================================================
// Template 2: 简约白 minimal
// ============================================================
function buildMinimal(input: CardInput): any {
  const { title, summary, source, date, brandName = 'AutoMedia' } = input
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#ffffff',
        fontFamily: 'Chinese Sans',
      },
      children: [
        // 左侧细彩色边条
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              width: '6px',
              height: '100%',
              background: '#e94560',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '56px 64px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '14px',
                    color: '#999',
                    marginBottom: '16px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  },
                  children: brandName,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#111',
                    marginBottom: '24px',
                    lineHeight: 1.3,
                    display: 'flex',
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '16px',
                    color: '#666',
                    lineHeight: 1.8,
                    flex: 1,
                    display: 'flex',
                  },
                  children: truncateSummary(summary),
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '13px',
                    color: '#999',
                    marginTop: '24px',
                  },
                  children: [
                    { type: 'span', props: { children: getDate(date) } },
                    { type: 'span', props: { style: { margin: '0 10px' }, children: '·' } },
                    { type: 'span', props: { children: source || brandName } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  }
}

// ============================================================
// Template 3: 学术风 academic
// ============================================================
function buildAcademic(input: CardInput): any {
  const { title, summary, source, date, brandName = 'AutoMedia' } = input
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#faf8f3',
        padding: '56px 64px',
        fontFamily: 'Chinese Sans',
        color: '#3a2f24',
      },
      children: [
        // 顶部栏：左侧日期 · 右侧品牌标记
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px',
              fontSize: '13px',
              color: '#8a7a66',
              letterSpacing: '1px',
            },
            children: [
              { type: 'span', props: { children: '— 每日札记 —' } },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    padding: '4px 10px',
                    border: '1px solid #8a7a66',
                    borderRadius: '2px',
                  },
                  children: brandName,
                },
              },
            ],
          },
        },
        // 标题
        {
          type: 'div',
          props: {
            style: {
              fontSize: '30px',
              fontWeight: 'bold',
              color: '#2a1f14',
              marginBottom: '20px',
              lineHeight: 1.4,
              display: 'flex',
            },
            children: title,
          },
        },
        // 引言区块（前引号 + 摘要 + 后引号）
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              paddingLeft: '20px',
              borderLeft: '3px solid #c9a961',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '40px',
                    color: '#c9a961',
                    lineHeight: 1,
                    marginBottom: '4px',
                    display: 'flex',
                  },
                  children: '"',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '17px',
                    color: '#5a4a3a',
                    lineHeight: 1.8,
                    display: 'flex',
                    flex: 1,
                  },
                  children: truncateSummary(summary, 180),
                },
              },
            ],
          },
        },
        // 页脚：日期（左）+ 来源（右）
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#8a7a66',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e0d5c1',
            },
            children: [
              { type: 'span', props: { children: getDate(date) } },
              { type: 'span', props: { children: `— ${source || brandName}` } },
            ],
          },
        },
      ],
    },
  }
}

// ============================================================
// Template 4: 小红书风 xhs
// ============================================================
function buildXhs(input: CardInput): any {
  const { title, summary, source, date, brandName = 'AutoMedia' } = input
  // 简单把 summary 切分为 tag（取前几个有意义的关键词）
  const tags = [source || brandName, getDate(date), '每日精选'].filter(Boolean)

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ffa94d 100%)',
        padding: '48px 56px',
        fontFamily: 'Chinese Sans',
        color: '#ffffff',
      },
      children: [
        // 顶部：品牌 + 右上角 emoji
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    padding: '6px 14px',
                    background: 'rgba(255,255,255,0.25)',
                    borderRadius: '999px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  },
                  children: `# ${brandName}`,
                },
              },
              // 右上角装饰块（替代 emoji，因为 satori 无法渲染彩色 emoji）
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '44px',
                    height: '44px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.35)',
                    border: '2px solid rgba(255,255,255,0.7)',
                  },
                },
              },
            ],
          },
        },
        // 大标题（punchy）
        {
          type: 'div',
          props: {
            style: {
              fontSize: '42px',
              fontWeight: 'bold',
              lineHeight: 1.25,
              marginBottom: '20px',
              textShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'flex',
            },
            children: title,
          },
        },
        // 摘要
        {
          type: 'div',
          props: {
            style: {
              fontSize: '16px',
              color: 'rgba(255,255,255,0.95)',
              lineHeight: 1.7,
              flex: 1,
              display: 'flex',
            },
            children: truncateSummary(summary, 140),
          },
        },
        // 底部：标签
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              gap: '10px',
              marginTop: '16px',
            },
            children: tags.map((tag) => ({
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#ff6b6b',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                },
                children: `#${tag}`,
              },
            })),
          },
        },
      ],
    },
  }
}

// ============================================================
// Template 5: 暖色手账 warm
// ============================================================
function buildWarm(input: CardInput): any {
  const { title, summary, source, date, brandName = 'AutoMedia' } = input
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#f5f0e8',
        padding: '52px 60px',
        fontFamily: 'Chinese Sans',
        color: '#5a4a3a',
      },
      children: [
        // 头部品牌行（带小圆点装饰）
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '10px',
                    height: '10px',
                    borderRadius: '999px',
                    background: '#e94560',
                    marginRight: '10px',
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '10px',
                    height: '10px',
                    borderRadius: '999px',
                    background: '#f0a858',
                    marginRight: '10px',
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '14px',
                    color: '#8a7a66',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                  },
                  children: `${brandName} · 手账`,
                },
              },
            ],
          },
        },
        // 标题
        {
          type: 'div',
          props: {
            style: {
              fontSize: '34px',
              fontWeight: 'bold',
              color: '#e94560',
              lineHeight: 1.3,
              marginBottom: '8px',
              display: 'flex',
            },
            children: title,
          },
        },
        // 标题下方的装饰下划线
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              width: '80px',
              height: '4px',
              background: '#f0a858',
              borderRadius: '2px',
              marginBottom: '24px',
            },
          },
        },
        // 摘要
        {
          type: 'div',
          props: {
            style: {
              fontSize: '16px',
              color: '#5a4a3a',
              lineHeight: 1.9,
              flex: 1,
              display: 'flex',
            },
            children: truncateSummary(summary, 180),
          },
        },
        // 底部：小圆点装饰 + 日期 + 来源
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '2px dashed #d4c4a8',
              fontSize: '13px',
              color: '#8a7a66',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          width: '6px',
                          height: '6px',
                          borderRadius: '999px',
                          background: '#e94560',
                          marginRight: '8px',
                        },
                      },
                    },
                    { type: 'span', props: { children: getDate(date) } },
                  ],
                },
              },
              { type: 'span', props: { children: source || brandName } },
            ],
          },
        },
      ],
    },
  }
}

// ============================================================
// 模板清单
// ============================================================
export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'dark-gradient',
    name: '深色渐变',
    description: '经典深蓝渐变，科技感十足，适合技术/行业资讯',
    build: buildDarkGradient,
  },
  {
    id: 'minimal',
    name: '简约白',
    description: '纯白底 + 彩色细边，编辑风，适合深度文章',
    build: buildMinimal,
  },
  {
    id: 'academic',
    name: '学术风',
    description: '米白纸质 + 引号装饰，书卷气息，适合观点摘录',
    build: buildAcademic,
  },
  {
    id: 'xhs',
    name: '小红书风',
    description: '粉橙渐变 + 标签徽章，活泼亮眼，适合社媒传播',
    build: buildXhs,
  },
  {
    id: 'warm',
    name: '暖色手账',
    description: '暖米底 + 彩色装饰点，手账风，适合日常记录',
    build: buildWarm,
  },
]

export const DEFAULT_TEMPLATE_ID = 'dark-gradient'

// ============================================================
// 主渲染器
// ============================================================
export const satoriRenderer: CardRenderer = {
  async render(input: CardInput, templateId: string = DEFAULT_TEMPLATE_ID): Promise<string> {
    const font = loadFont()

    // 根据 templateId 选择模板，未找到则回退到默认
    const template =
      CARD_TEMPLATES.find((t) => t.id === templateId) ||
      CARD_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!

    const element = template.build(input) as unknown as ReactNode

    const svg = await satori(element, {
      width: 800,
      height: 450,
      fonts: [
        {
          name: 'Chinese Sans',
          data: font,
          weight: 400,
          style: 'normal',
        },
      ],
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

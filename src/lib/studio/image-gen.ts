import { v4 as uuid } from 'uuid'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { db } from '@/lib/db/index'
import { aiSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateWithGemini } from './image-providers/google'
import { generateWithOpenAI } from './image-providers/openai'

const OUTPUT_DIR = join(process.cwd(), 'public/images/generated')

export interface GenerateCoverImageInput {
  prompt: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
}

export interface GenerateCoverImageResult {
  imagePath: string
  filename: string
  provider: string
}

function getImageSettings() {
  const row = db.select().from(aiSettings).where(eq(aiSettings.id, 'default')).get()
  if (!row) return null
  return {
    provider: row.imageProvider || '',
    baseUrl: row.imageBaseUrl || '',
    apiKey: row.imageApiKey || '',
    model: row.imageModel || '',
  }
}

function ratioToSize(ratio?: string): string {
  switch (ratio) {
    case '16:9': return '1536x1024'
    case '9:16': return '1024x1536'
    case '4:3': return '1280x960'
    case '3:4': return '960x1280'
    case '1:1':
    default: return '1024x1024'
  }
}

function buildPromptWithRatio(prompt: string, ratio?: string): string {
  const ratioHint = ratio === '16:9' ? '，横向 16:9 比例'
    : ratio === '9:16' ? '，竖向 9:16 比例'
    : ratio === '4:3' ? '，横向 4:3 比例'
    : ratio === '3:4' ? '，竖向 3:4 比例'
    : '，正方形 1:1 比例'
  return `${prompt}${ratioHint}`
}

export async function generateCoverImage(input: GenerateCoverImageInput): Promise<GenerateCoverImageResult> {
  const settings = getImageSettings()
  if (!settings?.provider || !settings.apiKey) {
    throw new Error('图片生成未配置，请在设置页填入 provider 和 API key')
  }

  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
  }

  const finalPrompt = buildPromptWithRatio(input.prompt, input.aspectRatio)
  let base64: string

  if (settings.provider === 'google') {
    base64 = await generateWithGemini({
      prompt: finalPrompt,
      apiKey: settings.apiKey,
      model: settings.model || undefined,
    })
  } else if (settings.provider === 'openai') {
    base64 = await generateWithOpenAI({
      prompt: finalPrompt,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl || undefined,
      model: settings.model || undefined,
      size: ratioToSize(input.aspectRatio),
    })
  } else {
    throw new Error(`不支持的 image provider: ${settings.provider}`)
  }

  const filename = `${uuid()}.png`
  const filePath = join(OUTPUT_DIR, filename)
  await writeFile(filePath, Buffer.from(base64, 'base64'))

  return {
    imagePath: `/images/generated/${filename}`,
    filename,
    provider: settings.provider,
  }
}

export function hasImageConfig(): boolean {
  const s = getImageSettings()
  return !!(s?.provider && s.apiKey)
}

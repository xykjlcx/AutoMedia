import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getModels } from '@/lib/ai/client'
import { satoriRenderer, DEFAULT_TEMPLATE_ID, CARD_TEMPLATES } from '@/lib/studio/card-renderer'
import { getDraft } from '@/lib/studio/queries'
import { db } from '@/lib/db/index'
import { shareCards, digestItems } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { readFileSync } from 'fs'

// AI 生成卡片文案的 schema
const cardCopySchema = z.object({
  title: z.string().describe('卡片标题，简洁有力，15 字以内'),
  summary: z.string().describe('卡片摘要，50-100 字，突出核心要点'),
})

// GET: 返回可用模板清单，前端用于渲染选择器
export async function GET() {
  return NextResponse.json({
    templates: CARD_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
    })),
    defaultTemplateId: DEFAULT_TEMPLATE_ID,
  })
}

export async function POST(req: Request) {
  const { draftId, digestItemId, template } = await req.json()

  if (!draftId && !digestItemId) {
    return NextResponse.json({ error: '需要 draftId 或 digestItemId' }, { status: 400 })
  }

  // 校验 templateId，非法值回退到默认
  const templateId =
    typeof template === 'string' && CARD_TEMPLATES.some((t) => t.id === template)
      ? template
      : DEFAULT_TEMPLATE_ID

  try {
    let title: string
    let content: string
    let source: string | undefined

    if (draftId) {
      // 从草稿获取内容
      const draft = getDraft(draftId)
      if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })
      title = draft.title
      content = draft.content
    } else {
      // 从精选条目获取内容
      const item = db.select().from(digestItems).where(eq(digestItems.id, digestItemId)).get()
      if (!item) return NextResponse.json({ error: '文章不存在' }, { status: 404 })
      title = item.title
      content = `${item.oneLiner}\n${item.summary}`
      source = item.source
    }

    // AI 生成卡片文案
    const { object: copy } = await generateObject({
      model: getModels().fast,
      schema: cardCopySchema,
      prompt: `为以下内容生成分享卡片文案：\n\n标题：${title}\n内容：${content}\n\n要求简洁有力，适合朋友圈/社群传播。`,
    })

    // 渲染卡片图片（带模板选择）
    const imagePath = await satoriRenderer.render(
      {
        title: copy.title,
        summary: copy.summary,
        source,
        date: new Date().toISOString().slice(0, 10),
      },
      templateId,
    )

    // 保存卡片记录到数据库
    const cardId = uuid()
    db.insert(shareCards).values({
      id: cardId,
      draftId: draftId || null,
      digestItemId: digestItemId || null,
      template: templateId,
      copyText: `${copy.title}\n${copy.summary}`,
      imagePath,
      createdAt: new Date().toISOString(),
    }).run()

    // 读取图片文件并转为 base64 返回
    const imageBuffer = readFileSync(imagePath)
    const base64 = imageBuffer.toString('base64')

    return NextResponse.json({
      id: cardId,
      copy,
      image: `data:image/png;base64,${base64}`,
      templateId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

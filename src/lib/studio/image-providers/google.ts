// Gemini 图片生成 REST API 调用
// 参考：https://ai.google.dev/gemini-api/docs/image-generation

export async function generateWithGemini(opts: {
  prompt: string
  apiKey: string
  model?: string
}): Promise<string> {
  const model = opts.model || 'gemini-2.5-flash-image-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini image API 失败 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }>
  }

  const parts = data.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data // base64
    }
  }
  throw new Error('Gemini 响应中未找到图片数据')
}

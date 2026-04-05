// OpenAI 图片生成 REST API 调用
// 参考：https://platform.openai.com/docs/api-reference/images/create

export async function generateWithOpenAI(opts: {
  prompt: string
  apiKey: string
  baseUrl?: string
  model?: string
  size?: string
}): Promise<string> {
  const model = opts.model || 'gpt-image-1'
  const size = opts.size || '1024x1024'
  const base = opts.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com'
  const url = `${base}/v1/images/generations`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI image API 失败 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as {
    data?: Array<{ b64_json?: string; url?: string }>
  }

  const item = data.data?.[0]
  if (item?.b64_json) return item.b64_json
  if (item?.url) {
    // 有些模型只返回 url，这里下载
    const imgRes = await fetch(item.url)
    const buf = await imgRes.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  }
  throw new Error('OpenAI 响应中未找到图片数据')
}

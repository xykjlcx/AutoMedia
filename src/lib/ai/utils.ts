// 从 AI 回复中提取 JSON（兼容 markdown 代码块、裸数组、裸对象）
export function extractJson(text: string): string | null {
  // 1. 尝试提取 ```json ... ``` 代码块
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  // 2. 尝试找 [ ... ]
  const bracket = text.indexOf('[')
  const lastBracket = text.lastIndexOf(']')
  if (bracket !== -1 && lastBracket > bracket) return text.slice(bracket, lastBracket + 1)
  // 3. 尝试找 { ... }
  const brace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (brace !== -1 && lastBrace > brace) return text.slice(brace, lastBrace + 1)
  return null
}

"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

// 预览组件：使用 react-markdown + GFM 扩展 + 代码高亮，替代此前的正则渲染
export function MarkdownPreview({ content, title }: { content: string; title?: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-serif-display prose-a:text-[var(--color-warm-accent)] prose-code:text-[var(--color-warm-accent)]">
      {title && <h1 className="text-xl font-bold font-serif-display mb-4">{title}</h1>}
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground/50 italic">暂无内容</p>
      )}
    </div>
  )
}

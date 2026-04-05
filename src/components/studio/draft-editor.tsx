"use client"

import dynamic from 'next/dynamic'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface DraftEditorProps {
  content: string
  onChange: (content: string) => void
}

export function DraftEditor({ content, onChange }: DraftEditorProps) {
  return (
    <div className="h-full" data-color-mode="dark">
      <MDEditor
        value={content}
        onChange={(val) => onChange(val || '')}
        height="100%"
        preview="edit"
        visibleDragbar={false}
        hideToolbar={false}
      />
    </div>
  )
}

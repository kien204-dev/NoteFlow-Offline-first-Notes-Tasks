import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownPreviewProps = {
  content: string
  compact?: boolean
}

export function MarkdownPreview({ content, compact = false }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return <p className="text-stone-500 dark:text-zinc-400">No content yet.</p>
  }

  return (
    <div
      className={
        compact
          ? 'markdown-preview markdown-preview-compact text-sm leading-6 text-stone-600 dark:text-zinc-300'
          : 'markdown-preview text-sm leading-6 text-ink dark:text-zinc-100'
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children }) => (
            <span className="font-medium text-amber-700 underline decoration-amber-300 dark:text-amber-200">
              {children}
            </span>
          ),
          input: ({ checked }) => (
            <span
              aria-hidden="true"
              className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-stone-400 text-[10px] dark:border-zinc-500"
            >
              {checked ? 'x' : ''}
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

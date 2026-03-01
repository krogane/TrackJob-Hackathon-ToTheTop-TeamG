import type { ReactNode } from 'react'

type ChatRichTextProps = {
  content: string
}

const BOLD_PATTERN = /\*\*([\s\S]+?)\*\*/g

export function ChatRichText({ content }: ChatRichTextProps) {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = BOLD_PATTERN.exec(content)) !== null) {
    const [fullMatch, boldContent] = match
    const matchIndex = match.index

    if (matchIndex > lastIndex) {
      nodes.push(content.slice(lastIndex, matchIndex))
    }

    if (boldContent.trim().length === 0) {
      nodes.push(fullMatch)
    } else {
      nodes.push(
        <strong key={`bold-${matchIndex}`} className="font-semibold text-text">
          {boldContent}
        </strong>,
      )
    }

    lastIndex = matchIndex + fullMatch.length
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex))
  }

  return <>{nodes}</>
}

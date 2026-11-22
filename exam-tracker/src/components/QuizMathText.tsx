import { formatQuizMathHtml, looksLikeMath, tidyMathPlain } from '../utils/formatQuizMath'

export function QuizMathText({
  text,
  className,
  as: Tag = 'span',
}: {
  text: string
  className?: string
  as?: 'span' | 'p' | 'div'
}) {
  const plain = tidyMathPlain(text || '')
  if (!plain) return null
  if (!looksLikeMath(plain)) {
    return <Tag className={className}>{plain}</Tag>
  }
  return (
    <Tag
      className={`qmath${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: formatQuizMathHtml(plain) }}
    />
  )
}

'use client'

import { useRef } from 'react'

import { cn } from '@/lib/utils'

interface TabsProps {
  options: Array<{ value: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  ariaLabel?: string
}

export function Tabs({ options, value, onValueChange, ariaLabel = 'タブ一覧' }: TabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  function moveFocus(nextIndex: number) {
    if (options.length === 0) {
      return
    }

    const clampedIndex = (nextIndex + options.length) % options.length
    const nextOption = options[clampedIndex]
    if (!nextOption) {
      return
    }
    onValueChange(nextOption.value)
    buttonRefs.current[clampedIndex]?.focus()
  }

  return (
    <div className="inline-flex rounded-xl border border-border bg-card2 p-1" role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-controls={`tab-panel-${option.value}`}
          tabIndex={value === option.value ? 0 : -1}
          ref={(element) => {
            buttonRefs.current[index] = element
          }}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              moveFocus(index + 1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              moveFocus(index - 1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              moveFocus(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              moveFocus(options.length - 1)
            }
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-[var(--cta-bg)] text-[var(--cta-text)] shadow-[var(--cta-shadow)]'
              : 'text-text2 hover:text-text',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

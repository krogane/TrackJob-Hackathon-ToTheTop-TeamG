import * as React from 'react'

import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          'flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text3 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

'use client'

import { useEffect, useRef } from 'react'
import type * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    containerRef.current?.focus()
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-[6px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onOpenChange(false)
        }
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full max-w-lg rounded-2xl border border-border bg-card text-text shadow-[0_18px_40px_rgba(35,55,95,0.14)]',
        className,
      )}
      {...props}
    />
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between border-b border-border px-6 py-4', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('font-display text-lg font-bold', className)} {...props} />
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('max-h-[70vh] overflow-y-auto px-6 py-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2 border-t border-border px-6 py-4', className)} {...props} />
}

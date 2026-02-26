'use client'

import { Button } from '@/components/ui/button'

interface MobileHeaderProps {
  onMenuClick: () => void
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
      <h1 className="font-body text-lg font-semibold text-text">KakeAI</h1>
      <Button size="sm" variant="ghost" onClick={onMenuClick} aria-label="メニューを開く">
        ☰
      </Button>
    </div>
  )
}

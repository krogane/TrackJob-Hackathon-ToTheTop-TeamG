'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { applyTheme, resolveTheme, saveTheme, toggleTheme, type ThemeMode } from '@/lib/theme'

const navItems = [
  { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/expense', label: '収支管理', icon: '💳' },
  { href: '/budget', label: '予算設定', icon: '🎯' },
  { href: '/future', label: 'ライフプラン', icon: '🔮' },
  { href: '/advice', label: 'KakeAI', icon: '💡' },
] as const

const activeNavItemClass =
  'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)] shadow-[var(--sidebar-active-shadow)] before:absolute before:inset-y-[20%] before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--sidebar-active-bar)]'

const inactiveNavItemClass = 'hover:bg-[var(--sidebar-hover-bg)] hover:text-text'

interface SidebarProps {
  mobileOpen?: boolean
  onNavigate?: () => void
}

export function Sidebar({ mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')

  useEffect(() => {
    const currentTheme = resolveTheme('light')
    setThemeMode(currentTheme)
    applyTheme(currentTheme)
  }, [])

  function handleThemeToggle() {
    const nextTheme = toggleTheme(themeMode)
    setThemeMode(nextTheme)
    applyTheme(nextTheme)
    saveTheme(nextTheme)
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[var(--sidebar-bg)] px-3 py-6 shadow-[var(--sidebar-shadow)] transition-transform md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <Link href="/dashboard" onClick={onNavigate} className="mb-8 flex items-center gap-2 px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 font-display text-sm font-extrabold text-white">
          K
        </div>
        <div className="font-body text-[30px] font-semibold leading-none tracking-tight text-text">
          Kake<span className="text-accent">AI</span>
        </div>
      </Link>

      <nav className="space-y-1 px-1" aria-label="サイドバー">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-text2 transition-colors',
                isActive ? activeNavItemClass : inactiveNavItemClass,
              )}
              onClick={onNavigate}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-border px-1 pt-4">
        <Button
          variant="ghost"
          className="h-auto w-full justify-start rounded-[10px] border-none bg-transparent px-3 py-2 text-sm text-text2 shadow-none hover:bg-accent/10 hover:text-text"
          onClick={handleThemeToggle}
        >
          <span className="text-base">{themeMode === 'dark' ? '☀️' : '🌙'}</span>
          {themeMode === 'dark' ? 'ライトモード' : 'ダークモード'}
        </Button>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            'relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-text2 transition-colors',
            pathname === '/settings' ? activeNavItemClass : inactiveNavItemClass,
          )}
        >
          <span className="text-base">⚙️</span>
          設定
        </Link>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start rounded-[10px] border-none bg-transparent px-3 py-2 text-sm text-text2 shadow-none hover:bg-accent/10 hover:text-text"
          onClick={async () => {
            const supabase = getSupabaseBrowserClient()
            await supabase.auth.signOut()
            router.replace('/login')
            onNavigate?.()
          }}
        >
          <span className="text-base">↩</span>
          ログアウト
        </Button>
      </div>
    </aside>
  )
}

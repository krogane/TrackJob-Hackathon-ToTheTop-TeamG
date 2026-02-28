'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { MobileHeader } from '@/components/layout/MobileHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { ApiError, authProfileApi } from '@/lib/api'
import { getSupabaseBrowserClient } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const supabase = getSupabaseBrowserClient()

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return

      if (!data.session) {
        router.replace('/login')
        return
      }

      // セッション確認完了 → 先に子コンポーネントを描画（OAuthコールバック等をブロックしないため）
      setCheckingSession(false)

      // 初回設定未完了（display_name が空）なら /setup へ（バックグラウンドで確認）
      try {
        const profile = await authProfileApi.get()
        if (!mounted) return
        if (profile.display_name === '') {
          router.replace('/setup')
          return
        }
      } catch (error) {
        if (!mounted) return
        if (error instanceof ApiError && error.status === 404) {
          router.replace('/setup')
          return
        }
        // ネットワークエラー等はダッシュボードをそのまま表示
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text2">セッション確認中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[var(--overlay)] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="メニューを閉じる"
        />
      ) : null}
      <MobileHeader onMenuClick={() => setMobileOpen(true)} />
      <main className="animate-fade-up p-4 md:p-8">{children}</main>
    </div>
  )
}

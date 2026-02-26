'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authProfileApi } from '@/lib/api'
import { getSupabaseBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message === 'Email not confirmed') {
          setError('メールアドレスが未認証です。送信した確認メールのリンクをクリックしてください。')
        } else {
          setError(authError.message)
        }
        return
      }

      // 初回ログイン判定: display_name が空なら初回設定へ
      try {
        const profile = await authProfileApi.get()
        if (profile.display_name === '') {
          router.push('/setup')
        } else {
          router.push('/dashboard')
        }
      } catch {
        // プロフィール未作成（トリガー未設定など）の場合も初回設定へ
        router.push('/setup')
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_10px_28px_rgba(35,55,95,0.06)]">
        <h1 className="font-display text-2xl font-bold">ログイン</h1>
        <p className="mt-1 text-sm text-text2">KakeAI を利用するにはログインしてください。</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-text2" htmlFor="email">
              メールアドレス
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-text2" htmlFor="password">
              パスワード
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-text2">
          アカウントをお持ちでない方は{' '}
          <Link className="text-accent underline" href="/register">
            新規登録
          </Link>
        </p>
      </div>
    </main>
  )
}

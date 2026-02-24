'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authProfileApi } from '@/lib/api'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { useChatWizardStore } from '@/stores/chatWizardStore'

export default function RegisterPage() {
  const router = useRouter()
  const openChatWizard = useChatWizardStore((state) => state.open)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // メール確認が必要な場合、signUp直後はセッションがなくAPI呼び出しが失敗する。
      // ウィザード保存時に使えるよう、プロフィール情報をlocalStorageに退避しておく。
      localStorage.setItem(
        'lifebalance:pending-profile',
        JSON.stringify({ display_name: displayName }),
      )

      try {
        await authProfileApi.create({
          display_name: displayName,
        })
        // 作成成功したので退避データは不要
        localStorage.removeItem('lifebalance:pending-profile')
      } catch (apiError) {
        // Phase 1: B担当API未完成時はプロフィール初期化をスキップして先行する
        console.warn('POST /api/auth/profile skipped:', apiError)
      }

      router.push('/dashboard')
      openChatWizard('setup')
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : '登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-6">
        <h1 className="font-display text-2xl font-bold">新規登録</h1>
        <p className="mt-1 text-sm text-text2">基本情報を入力してアカウントを作成してください。</p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-text2" htmlFor="displayName">
              表示名
            </label>
            <Input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-text2" htmlFor="email">
              メールアドレス
            </label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-text2" htmlFor="password">
              パスワード
            </label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登録中...' : '登録する'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-text2">
          すでにアカウントをお持ちの方は{' '}
          <Link className="text-accent underline" href="/login">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  )
}

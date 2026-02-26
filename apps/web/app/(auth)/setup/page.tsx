'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChatWizard } from '@/hooks/useChatWizard'
import { useToast } from '@/hooks/useToast'
import { ApiError, authProfileApi } from '@/lib/api'
import { getSupabaseBrowserClient } from '@/lib/supabase'

function AiAvatar() {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-lg">
        🤖
      </div>
    )
  }

  return (
    <img
      src="/ai-avatar.svg"
      alt="AIアシスタント"
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
      onError={() => setImgError(true)}
    />
  )
}

type Step = 'checking' | 'name' | 'wizard'

export default function SetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const wizard = useChatWizard()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('checking')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')

  // 認証・セットアップ済みチェック
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/login')
        return
      }
      try {
        const profile = await authProfileApi.get()
        if (profile.display_name !== '') {
          router.replace('/dashboard')
          return
        }
      } catch (error) {
        if (error instanceof ApiError && error.status !== 404) {
          router.replace('/dashboard')
          return
        }
      }
      setStep('name')
    })
  }, [router])

  // チャットの自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [wizard.messages, wizard.loading])

  // shouldAutoClose: 自動保存 → ダッシュボードへ
  useEffect(() => {
    if (!wizard.shouldAutoClose) return

    void (async () => {
      try {
        const result = await wizard.saveConfig()
        toast({
          title: result.persisted ? '設定を保存しました' : '設定内容を確認用として保持しました',
          variant: result.persisted ? 'success' : 'default',
        })
      } catch {
        toast({ title: '設定保存に失敗しました', variant: 'error' })
      } finally {
        router.push('/dashboard')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.shouldAutoClose])

  const canSave = useMemo(
    () => wizard.isComplete && wizard.config && !wizard.saving,
    [wizard.config, wizard.isComplete, wizard.saving],
  )

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNameError('')
    setSavingName(true)
    try {
      await authProfileApi.update({ display_name: displayName })
      setStep('wizard')
    } catch {
      setNameError('表示名の保存に失敗しました。もう一度お試しください。')
    } finally {
      setSavingName(false)
    }
  }

  if (step === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text2">読み込み中...</p>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_10px_28px_rgba(35,55,95,0.06)]">
          <h1 className="font-display text-2xl font-bold">はじめまして</h1>
          <p className="mt-1 text-sm text-text2">アプリ内で使う表示名を入力してください。</p>

          <form onSubmit={handleNameSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-text2" htmlFor="displayName">
                表示名
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例: 田中 太郎"
                required
                minLength={1}
                maxLength={50}
              />
            </div>
            {nameError ? <p className="text-sm text-danger">{nameError}</p> : null}
            <Button type="submit" className="w-full" disabled={savingName}>
              {savingName ? '保存中...' : '次へ（初期設定へ）'}
            </Button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">初期設定</h1>
          <p className="mt-1 text-sm text-text2">AIとの会話で月収・目標・予算を設定します。</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_28px_rgba(35,55,95,0.06)]">
          {wizard.mode === 'fallback' ? (
            <p className="mb-3 rounded-md border border-warn/40 bg-warn/25 px-3 py-2 text-xs text-[var(--warn-text)]">
              AI応答の代わりにルールベースで進行中です。
            </p>
          ) : null}

          <div
            className="max-h-[400px] space-y-4 overflow-y-auto rounded-xl border border-border bg-card2 p-3"
            aria-live="polite"
          >
            {wizard.messages.map((message, index) =>
              message.role === 'model' ? (
                <div key={`${message.role}-${index}`} className="flex items-start gap-2">
                  <AiAvatar />
                  <div className="max-w-[85%] rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-text">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={`${message.role}-${index}`} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-tr-none border border-border bg-card px-3 py-2 text-sm text-text">
                    {message.content}
                  </div>
                </div>
              ),
            )}
            {wizard.loading ? (
              <div className="flex items-start gap-2">
                <AiAvatar />
                <div className="max-w-[85%] rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce text-accent" style={{ animationDelay: '0ms' }}>●</span>
                    <span className="animate-bounce text-accent" style={{ animationDelay: '150ms' }}>●</span>
                    <span className="animate-bounce text-accent" style={{ animationDelay: '300ms' }}>●</span>
                  </span>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {wizard.error ? <p className="mt-3 text-xs text-danger">{wizard.error}</p> : null}

          {wizard.isComplete && wizard.config ? (
            <div className="mt-4 space-y-2 rounded-xl border border-accent/30 bg-accent/10 p-3">
              <p className="text-sm font-semibold">設定プレビュー</p>
              <pre className="overflow-x-auto text-xs text-text2">{JSON.stringify(wizard.config, null, 2)}</pre>
            </div>
          ) : (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void wizard.send()
              }}
            >
              <Input
                value={wizard.input}
                onChange={(event) => wizard.setInput(event.target.value)}
                placeholder="回答を入力してください"
                disabled={wizard.loading}
                aria-label="チャット入力"
              />
              <Button type="submit" disabled={!wizard.canSend}>
                送信
              </Button>
            </form>
          )}

          <div className="mt-4 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => wizard.reset()}>
              やり直す
            </Button>
            <Button
              type="button"
              disabled={!canSave}
              onClick={async () => {
                try {
                  const result = await wizard.saveConfig()
                  toast({
                    title: result.persisted ? '設定を保存しました' : '設定内容を確認用として保持しました',
                    variant: result.persisted ? 'success' : 'default',
                  })
                  router.push('/dashboard')
                } catch {
                  toast({ title: '設定保存に失敗しました', variant: 'error' })
                }
              }}
            >
              {wizard.saving ? '保存中...' : '保存する'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

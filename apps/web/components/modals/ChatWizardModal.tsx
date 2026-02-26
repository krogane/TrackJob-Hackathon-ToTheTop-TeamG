'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useChatWizard } from '@/hooks/useChatWizard'
import { useToast } from '@/hooks/useToast'
import { useChatWizardStore } from '@/stores/chatWizardStore'

/**
 * AIアバター画像
 * 本番用画像は apps/web/public/ai-avatar.png（PNG形式、推奨サイズ 128×128px）に配置してください。
 * 画像が見つからない場合は仮のアイコンにフォールバックします。
 */
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

export function ChatWizardModal() {
  const isOpen = useChatWizardStore((state) => state.isOpen)
  const close = useChatWizardStore((state) => state.close)
  const { toast } = useToast()

  const wizard = useChatWizard()
  const bottomRef = useRef<HTMLDivElement>(null)

  // 最新メッセージまで自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [wizard.messages, wizard.loading])

  // 「これで記録を終了します」→ 自動保存＆クローズ
  useEffect(() => {
    if (!wizard.shouldAutoClose) return

    void (async () => {
      try {
        const result = await wizard.saveConfig()
        toast({
          title: result.persisted ? '設定を保存しました' : '設定内容を確認用として保持しました',
          description: result.persisted ? undefined : 'API未接続のため一部はコンソールログへ出力されています。',
          variant: result.persisted ? 'success' : 'default',
        })
      } catch {
        toast({ title: '設定保存に失敗しました', variant: 'error' })
      } finally {
        close()
        wizard.reset()
      }
    })()
    // shouldAutoClose が true になった一度だけ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.shouldAutoClose])

  const canSave = useMemo(
    () => wizard.isComplete && wizard.config && !wizard.saving,
    [wizard.config, wizard.isComplete, wizard.saving],
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[720px] bg-card">
        <DialogHeader>
          <DialogTitle>チャットウィザード（AI）</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[58vh] py-3">
          <div className="mb-3 text-xs text-text2">会話で設定を作成し、完了時にまとめて保存します。</div>
          {wizard.mode === 'fallback' ? (
            <p className="mb-3 rounded-md border border-warn/40 bg-warn/25 px-3 py-2 text-xs text-[var(--warn-text)]">
              AI応答の代わりにルールベースで進行中です。
            </p>
          ) : null}

          <div
            className="max-h-[360px] space-y-4 overflow-y-auto rounded-xl border border-border bg-card2 p-3"
            aria-live="polite"
          >
            {wizard.messages.map((message, index) =>
              message.role === 'model' ? (
                // AIメッセージ: アイコン左 + 吹き出し右
                <div key={`${message.role}-${index}`} className="flex items-start gap-2">
                  <AiAvatar />
                  <div className="max-w-[85%] rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-text">
                    {message.content}
                  </div>
                </div>
              ) : (
                // ユーザーメッセージ: 右揃え吹き出し
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
            {/* 自動スクロール用センチネル */}
            <div ref={bottomRef} />
          </div>

          {wizard.error ? <p className="mt-3 text-xs text-danger">{wizard.error}</p> : null}

          {wizard.isComplete && wizard.config ? (
            <div className="mt-3 space-y-2 rounded-xl border border-accent/30 bg-accent/10 p-3">
              <p className="text-sm font-semibold">設定プレビュー</p>
              <pre className="overflow-x-auto text-xs text-text2">{JSON.stringify(wizard.config, null, 2)}</pre>
            </div>
          ) : (
            <form
              className="mt-3 flex gap-2"
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
              <Button
                type="submit"
                className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
                disabled={!wizard.canSend}
                aria-label="送信"
              >
                送信
              </Button>
            </form>
          )}
        </DialogBody>
        <DialogFooter className="justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                wizard.reset()
              }}
            >
              やり直す
            </Button>
            <Button type="button" variant="ghost" onClick={() => close()}>
              閉じる
            </Button>
          </div>

          <Button
            type="button"
            className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
            disabled={!canSave}
            onClick={async () => {
              try {
                const result = await wizard.saveConfig()
                toast({
                  title: result.persisted ? '設定を保存しました' : '設定内容を確認用として保持しました',
                  description: result.persisted ? undefined : 'API未接続のため一部はコンソールログへ出力されています。',
                  variant: result.persisted ? 'success' : 'default',
                })
                close()
                wizard.reset()
              } catch {
                toast({
                  title: '設定保存に失敗しました',
                  variant: 'error',
                })
              }
            }}
          >
            {wizard.saving ? '保存中...' : '保存する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

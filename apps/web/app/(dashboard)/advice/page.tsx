'use client'

import { useEffect, useRef, useState } from 'react'

import { ScoreHistoryChart } from '@/components/charts/ScoreHistoryChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAdvice } from '@/hooks/useAdvice'
import { adviceApi } from '@/lib/api'
import type { AdviceItem } from '@lifebalance/shared/types'

type DisplayAdviceItem = AdviceItem & {
  urgent?: boolean
}

export default function AdvicePage() {
  const { advice, history, loading, refreshing, error, refresh } = useAdvice()

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAI</h1>
        <p className="text-sm text-text2">読み込み中...</p>
      </div>
    )
  }

  if (!advice) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAI</h1>
        <p className="text-sm text-danger">{error ?? 'アドバイスがありません。'}</p>
        <Button onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? '更新中...' : '再取得する'}
        </Button>
      </div>
    )
  }

  const improvementItems: DisplayAdviceItem[] = [
    ...advice.content.urgent.map((item) => ({
      ...item,
      urgent: true,
    })),
    ...advice.content.suggestions,
  ]

  return (
    <div className="space-y-5 pb-20 md:pb-28">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAI</h1>
          <p className="text-sm text-text2">緊急度と改善効果に応じた家計アクションを確認できます</p>
        </div>
        <Button variant="ghost" className="h-11 px-5 text-sm font-semibold" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? '更新中...' : 'KakeAIを更新'}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <Card className="bg-card">
            <CardContent className="grid gap-4 p-0 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="rounded-xl border border-border bg-bg2 p-4">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <p className="text-xs text-text2">家計スコア</p>
                  <p className="font-display text-5xl font-bold text-accent">{advice.score}</p>
                  <p className="text-xs text-text2">100点満点</p>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-text">来月の目標</p>
                  {advice.content.next_month_goals.length > 0 ? (
                    <ul className="space-y-1 pl-4 text-xs text-text2">
                      {advice.content.next_month_goals.map((goal) => (
                        <li key={goal} className="list-disc">
                          {goal}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-text2">来月の目標はまだありません。</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg2 p-3">
                {history.length > 0 ? (
                  <ScoreHistoryChart data={history} />
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-text2">スコア履歴がまだありません</div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <AdviceSection title="改善提案" items={improvementItems} />
            <AdviceSection title="継続中の良い点" items={advice.content.positives} />
          </div>
        </div>
        <QuestionPanel />
      </div>
    </div>
  )
}

function AdviceSection({ title, items }: { title: string; items: DisplayAdviceItem[] }) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-accent">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-text2">表示できる項目はありません。</p> : null}
        {items.map((item) => (
          <article
            key={`${item.title}-${item.body}`}
            className={`rounded-lg border p-3 ${
              item.urgent ? 'border-danger/30 bg-danger/10' : 'border-border bg-bg2'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">{item.title}</h3>
              {item.urgent ? (
                <span className="rounded-full border border-danger/40 bg-danger/20 px-2 py-0.5 text-[10px] font-bold text-danger">
                  緊急
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text2">{item.body}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}

type QaMessage = { role: 'user' | 'ai'; content: string }

function QuestionPanel() {
  const [messages, setMessages] = useState<QaMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      const { answer } = await adviceApi.question(question)
      setMessages((prev) => [...prev, { role: 'ai', content: answer }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: error instanceof Error ? error.message : '回答の取得に失敗しました。' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex h-full flex-col bg-card">
      <CardHeader className="shrink-0">
        <CardTitle className="text-base text-accent">🤖 KakeAIに質問する</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-bg2 p-3"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="flex items-start gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/20 text-sm">🤖</div>
              <p className="rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-text">
                家計・節約・投資について何でも質問してください！
              </p>
            </div>
          ) : (
            messages.map((msg, index) =>
              msg.role === 'ai' ? (
                <div key={index} className="flex items-start gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/20 text-sm">🤖</div>
                  <p className="max-w-[85%] rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-text">
                    {msg.content}
                  </p>
                </div>
              ) : (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[85%] rounded-lg rounded-tr-none border border-border bg-card px-3 py-2 text-sm text-text">
                    {msg.content}
                  </p>
                </div>
              ),
            )
          )}
          {loading ? (
            <div className="flex items-start gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/20 text-sm">🤖</div>
              <div className="rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2">
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
        <form className="flex shrink-0 gap-2" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="質問を入力してください"
            disabled={loading}
            aria-label="質問入力"
          />
          <Button
            type="submit"
            className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
            disabled={!input.trim() || loading}
            aria-label="送信"
          >
            送信
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

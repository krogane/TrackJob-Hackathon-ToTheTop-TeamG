'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ScoreHistoryChart } from '@/components/charts/ScoreHistoryChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAdvice } from '@/hooks/useAdvice'
import { adviceApi } from '@/lib/api'
import type { AdviceItem } from '@lifebalance/shared/types'

type DisplayAdviceItem = AdviceItem & {
  urgent?: boolean
}

type AdviceDetailModalContent = {
  detailKey: string
  sectionTitle: string
  title: string
  summary: string
  proposalItems: string[]
  urgent?: boolean
  isGenerating: boolean
  generationError: string | null
}

const IMPROVEMENT_DETAIL_FALLBACK_ITEMS: string[] = []

export default function AdvicePage() {
  const { advice, history, loading, refreshing, error, refresh } = useAdvice()
  const [selectedAdvice, setSelectedAdvice] = useState<AdviceDetailModalContent | null>(null)
  const [adviceDetailCache, setAdviceDetailCache] = useState<Record<string, string[]>>({})
  const detailRequestIdRef = useRef(0)

  const handleSelectImprovementAdvice = useCallback(
    async (item: DisplayAdviceItem) => {
      const detailKey = buildAdviceDetailKey(item, '改善提案')
      const baseDetail = buildAdviceDetailModalContent(item, '改善提案')
      const cachedProposalItems = adviceDetailCache[detailKey]

      if (cachedProposalItems) {
        setSelectedAdvice({
          ...baseDetail,
          proposalItems: cachedProposalItems,
          isGenerating: false,
          generationError: null,
        })
        return
      }

      const requestId = detailRequestIdRef.current + 1
      detailRequestIdRef.current = requestId

      setSelectedAdvice({
        ...baseDetail,
        isGenerating: true,
        generationError: null,
      })

      try {
        const response = await adviceApi.detail({
          section: 'improvement',
          title: item.title,
          summary: item.body,
          urgent: item.urgent,
        })

        if (detailRequestIdRef.current !== requestId) {
          return
        }

        const proposalItems = normalizeProposalItems(response.proposal_items)
        setAdviceDetailCache((prev) => ({
          ...prev,
          [detailKey]: proposalItems,
        }))

        setSelectedAdvice((prev) => {
          if (!prev || prev.detailKey !== detailKey) {
            return prev
          }
          return {
            ...prev,
            proposalItems,
            isGenerating: false,
            generationError: null,
          }
        })
      } catch (requestError) {
        if (detailRequestIdRef.current !== requestId) {
          return
        }

        setSelectedAdvice((prev) => {
          if (!prev || prev.detailKey !== detailKey) {
            return prev
          }
          return {
            ...prev,
            isGenerating: false,
            generationError: requestError instanceof Error ? requestError.message : '提案の生成に失敗しました。',
          }
        })
      }
    },
    [adviceDetailCache],
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAIからの提案</h1>
        <p className="text-sm text-text2">読み込み中...</p>
      </div>
    )
  }

  if (!advice) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAIからの提案</h1>
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
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAIからの提案</h1>
          <p className="text-sm text-text2">家計スコアやKakeAIからの改善提案を確認できます</p>
        </div>
        <Button
          variant="ghost"
          className="h-11 px-5 text-sm font-semibold hover:!border-[var(--cta-bg)] hover:!bg-[var(--cta-bg)] hover:!text-[var(--cta-text)]"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          {refreshing ? '更新中...' : 'KakeAIの提案を更新'}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-card md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-accent">家計スコア</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-end pb-0">
                  <div className="inline-flex items-end gap-1 font-display leading-none">
                    <span className="text-8xl font-bold text-accent">{advice.score}</span>
                    <span className="mb-1 text-3xl font-semibold text-text2">/100</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-accent">来月の目標</CardTitle>
                </CardHeader>
                <CardContent>
                  {advice.content.next_month_goals.length > 0 ? (
                    <ul className="space-y-2 pl-5 text-base text-text md:text-lg">
                      {advice.content.next_month_goals.map((goal) => (
                        <li key={goal} className="list-disc">
                          {goal}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base text-text2">来月の目標はまだありません。</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-accent">家計スコアの推移</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border bg-bg2 p-3">
                  {history.length > 0 ? (
                    <ScoreHistoryChart data={history} />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-text2">スコア履歴がまだありません</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <QuestionPanel />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdviceSection
            title="改善提案"
            items={improvementItems}
            onSelectItem={(item) => {
              void handleSelectImprovementAdvice(item)
            }}
          />
          <AdviceSection title="継続中の良い点" items={advice.content.positives} />
        </div>
      </div>

      <AdviceDetailDialog detail={selectedAdvice} onOpenChange={(open) => !open && setSelectedAdvice(null)} />
    </div>
  )
}

function AdviceSection({
  title,
  items,
  onSelectItem,
}: {
  title: string
  items: DisplayAdviceItem[]
  onSelectItem?: (item: DisplayAdviceItem) => void
}) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-accent">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-text2">表示できる項目はありません。</p> : null}
        {items.map((item) => {
          const className = `w-full rounded-lg border p-3 text-left ${
            item.urgent ? 'border-danger/30 bg-danger/10' : 'border-border bg-bg2'
          }`

          if (onSelectItem) {
            return (
              <button
                key={`${item.title}-${item.body}`}
                type="button"
                onClick={() => onSelectItem(item)}
                className={`${className} transition-colors ${
                  item.urgent ? 'hover:border-danger/50' : 'hover:border-accent/40'
                }`}
                aria-label={`${item.title}の詳細を表示`}
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
                <p className="mt-2 text-[11px] font-semibold text-accent">クリックして詳細を見る</p>
              </button>
            )
          }

          return (
            <article key={`${item.title}-${item.body}`} className={className}>
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
          )
        })}
      </CardContent>
    </Card>
  )
}

function AdviceDetailDialog({
  detail,
  onOpenChange,
}: {
  detail: AdviceDetailModalContent | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={detail !== null} onOpenChange={onOpenChange}>
      {detail ? (
        <DialogContent className="max-w-xl min-h-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{detail.title}</span>
              {detail.urgent ? (
                <span className="rounded-full border border-danger/40 bg-danger/20 px-3 py-1 text-xs font-bold text-danger">
                  緊急
                </span>
              ) : null}
            </DialogTitle>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {detail.sectionTitle === '改善提案' ? null : <p className="text-sm font-semibold text-text2">{detail.sectionTitle}</p>}
            {detail.sectionTitle === '改善提案' ? (
              <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
                <p className="text-base text-text md:text-lg">{detail.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-text">{detail.summary}</p>
            )}

            <section className="space-y-3 pt-4">
              <h3 className={detail.sectionTitle === '改善提案' ? 'text-lg font-semibold text-text md:text-xl' : 'text-base font-semibold text-text'}>
                具体的な提案
              </h3>
              {detail.isGenerating ? <p className="text-sm text-text2">KakeAIが具体案を生成中です...</p> : null}
              {detail.generationError ? <p className="text-xs text-danger">{detail.generationError}</p> : null}
              {!detail.isGenerating && !detail.generationError && detail.proposalItems.length === 0 ? (
                <p className="text-sm text-text2">具体的な提案はまだありません。</p>
              ) : null}
              {detail.proposalItems.length > 0 ? (
                <ul className={detail.sectionTitle === '改善提案' ? 'space-y-2 pl-5 text-base text-text2 md:text-lg' : 'space-y-2 pl-5 text-sm text-text2'}>
                  {detail.proposalItems.map((proposal) => (
                    <li key={proposal} className="list-disc">
                      {proposal}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function buildAdviceDetailKey(item: DisplayAdviceItem, sectionTitle: string) {
  return `${sectionTitle}:${item.title}:${item.body}:${item.urgent ? '1' : '0'}`
}

function normalizeProposalItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function buildAdviceDetailModalContent(item: DisplayAdviceItem, sectionTitle: string): AdviceDetailModalContent {
  const detailKey = buildAdviceDetailKey(item, sectionTitle)

  return {
    detailKey,
    sectionTitle,
    title: item.title,
    summary: item.body,
    proposalItems: [],
    urgent: item.urgent,
    isGenerating: false,
    generationError: null,
  }
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
      <CardContent className="flex flex-col gap-4">
        <div
          className="max-h-[360px] space-y-3 overflow-y-auto"
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
            className="min-w-12 bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)] md:min-w-16"
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

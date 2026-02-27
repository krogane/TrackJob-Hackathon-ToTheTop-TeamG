'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdviceItem, Transaction, TransactionCategory } from '@lifebalance/shared/types'

import { TrendChart } from '@/components/charts/TrendChart'
import { AddExpenseModal } from '@/components/modals/AddExpenseModal'
import { AddIncomeModal } from '@/components/modals/AddIncomeModal'
import { EditTransactionModal } from '@/components/modals/EditTransactionModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs } from '@/components/ui/tabs'
import { useAdvice } from '@/hooks/useAdvice'
import { useBudgets } from '@/hooks/useBudgets'
import { useGoals } from '@/hooks/useGoals'
import { useRecordingStreak, useTransactionTrend, useTransactions, useTransactionSummary } from '@/hooks/useTransactions'
import { adviceApi, authProfileApi } from '@/lib/api'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'

const tabs = [
  { value: '1m', label: '1ヶ月' },
  { value: '3m', label: '3ヶ月' },
  { value: '1y', label: '1年' },
]

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  housing: '住居費',
  food: '食費',
  transport: '交通費',
  entertainment: '娯楽',
  clothing: '衣類',
  communication: '通信',
  medical: '医療',
  social: '交際費',
  other: 'その他',
  salary: '給与',
  bonus: '賞与',
  side_income: '副収入',
}

type RangeKey = '1m' | '3m' | '1y'

type TrendPoint = {
  expense: number
  budget?: number
}

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

const IMPROVEMENT_DETAIL_FALLBACK_ITEMS = [
  '直近14日間の同カテゴリ支出を確認し、固定費・変動費に分けて改善対象を明確化する',
  '金額インパクトが大きい項目から優先順位を付け、今月中に1件見直す',
  '週の中間時点で実績を確認し、必要なら予算配分を微調整する',
]

function calculateBudgetAchievementStreak(points: TrendPoint[]) {
  let streak = 0
  for (const point of points) {
    if (typeof point.budget !== 'number' || point.budget <= 0) break
    if (point.expense <= point.budget) {
      streak += 1
      continue
    }
    break
  }
  return streak
}

function getDashboardGreeting(now: Date) {
  const hourInJst = Number(
    new Intl.DateTimeFormat('ja-JP', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Tokyo',
    }).format(now),
  )

  if (hourInJst >= 5 && hourInJst <= 10) {
    return 'おはようございます'
  }

  return 'おかえりなさい'
}

function buildAdviceDetailKey(item: DisplayAdviceItem, sectionTitle: string) {
  return `${sectionTitle}:${item.title}:${item.body}:${item.urgent ? '1' : '0'}`
}

function normalizeProposalItems(items: string[], fallbackItems: string[]) {
  const normalizedItems = [...new Set(items.map((item) => item.trim()).filter(Boolean))]
  if (normalizedItems.length === 0) {
    return fallbackItems
  }
  return normalizedItems
}

function buildAdviceDetailModalContent(item: DisplayAdviceItem, sectionTitle: string): AdviceDetailModalContent {
  const detailKey = buildAdviceDetailKey(item, sectionTitle)
  return {
    detailKey,
    sectionTitle,
    title: item.title,
    summary: item.body,
    proposalItems: IMPROVEMENT_DETAIL_FALLBACK_ITEMS,
    urgent: item.urgent,
    isGenerating: false,
    generationError: null,
  }
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>('1m')
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [incomeModalOpen, setIncomeModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [displayName, setDisplayName] = useState('ユーザー')
  const [now, setNow] = useState(() => new Date())
  const [selectedAdvice, setSelectedAdvice] = useState<AdviceDetailModalContent | null>(null)
  const [adviceDetailCache, setAdviceDetailCache] = useState<Record<string, string[]>>({})
  const detailRequestIdRef = useRef(0)

  const currentYearMonth = getCurrentYearMonth()

  const { data: currentSummary } = useTransactionSummary(currentYearMonth)
  const { budgetSummary } = useBudgets(currentYearMonth)
  const { goals } = useGoals('all')
  const { streakDays } = useRecordingStreak()
  const { transactions: recentTransactions, isLoading: transactionsLoading } = useTransactions({
    year_month: currentYearMonth,
    page: 1,
    limit: 4,
    order: 'desc',
    sort: 'transacted_at',
  })
  const { advice, loading: adviceLoading } = useAdvice()
  const { data: rawTrendData } = useTransactionTrend(range)
  const { data: yearlyTrendData } = useTransactionTrend('1y')

  useEffect(() => {
    let mounted = true
    authProfileApi
      .get()
      .then((profile) => {
        if (!mounted) return
        const name = profile.display_name.trim()
        if (name) {
          setDisplayName(name)
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const totalBudget = budgetSummary?.total_budget ?? 0
  const totalExpense = currentSummary?.total_expense ?? 0
  const expenseRate = totalExpense / Math.max(1, totalBudget)
  const overAmount = Math.max(totalExpense - totalBudget, 0)
  const ringPercent = Math.min(Math.max(expenseRate, 0), 1) * 100
  const displayPercent = Math.round(expenseRate * 100)
  const budgetUsageTone =
    expenseRate > 0.8
      ? 'var(--danger)'
      : expenseRate > 0.5
        ? 'var(--warn)'
        : 'var(--accent)'

  const guidanceMessage = useMemo(() => {
    if (expenseRate > 1) {
      return `予算を${overAmount.toLocaleString('ja-JP')}円超えています。支出ペースの見直しが必要です。`
    }
    if (expenseRate > 0.8) {
      return 'おっと、残り予算がかなり少なくなっています。'
    }
    if (expenseRate > 0.5) {
      return '残り予算は半分以下です。ここからが大事です。'
    }
    return 'いい調子です。支出をコントロールできていますね。'
  }, [expenseRate, overAmount])

  const todayLabel = useMemo(() => {
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()]
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}年${month}月${day}日（${weekday}）`
  }, [now])

  const greeting = useMemo(() => getDashboardGreeting(now), [now])

  const trendData = useMemo(() => {
    const year = parseInt(currentYearMonth.slice(0, 4))
    const month = parseInt(currentYearMonth.slice(5, 7))
    const daysInMonth = new Date(year, month, 0).getDate()

    let periodBudget: number
    if (range === '1m') {
      periodBudget = totalBudget / daysInMonth
    } else if (range === '3m') {
      periodBudget = (totalBudget * 7) / daysInMonth
    } else {
      periodBudget = totalBudget
    }

    return (rawTrendData ?? []).map((point) => ({
      ...point,
      budget: periodBudget,
    }))
  }, [rawTrendData, totalBudget, range, currentYearMonth])

  const budgetAchievementStreak = useMemo(() => {
    const points = [...(yearlyTrendData ?? [])].reverse()
    return calculateBudgetAchievementStreak(points)
  }, [yearlyTrendData])

  const previewAdviceItems = useMemo<DisplayAdviceItem[]>(() => {
    if (!advice) return []
    if (advice.content.urgent.length > 0) {
      return advice.content.urgent.slice(0, 2).map((item) => ({
        ...item,
        urgent: true,
      }))
    }
    return advice.content.suggestions.slice(0, 2)
  }, [advice])

  async function handleSelectPreviewAdvice(item: DisplayAdviceItem) {
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

      const proposalItems = normalizeProposalItems(response.proposal_items, IMPROVEMENT_DETAIL_FALLBACK_ITEMS)
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
  }

  return (
    <div className="space-y-4 pb-20 md:pb-28">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">
            {greeting}、{displayName}さん。
          </h1>
          <p className="text-sm text-text2">
            <span className="mr-2">{todayLabel}</span>
            <span>{guidanceMessage}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-12 bg-[var(--cta-bg)] px-6 text-base font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] hover:bg-[var(--cta-hover)]"
            onClick={() => setIncomeModalOpen(true)}
          >
            ＋ 収入を追加
          </Button>
          <Button
            className="h-12 bg-[var(--cta-bg)] px-6 text-base font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] hover:bg-[var(--cta-hover)]"
            onClick={() => setExpenseModalOpen(true)}
          >
            ＋ 支出を追加
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/expense" className="block sm:col-span-2 lg:col-span-2">
          <Card className="min-h-[220px] cursor-pointer bg-card transition-transform hover:-translate-y-[1px]">
            <CardContent className="h-full">
              <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-accent">今月の支出</p>
                    <p className="font-display text-[34px] font-bold tracking-[-0.02em] text-text">{formatCurrency(totalExpense)}</p>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-accent">今月の予算</p>
                    <p className="font-display text-[34px] font-bold tracking-[-0.02em] text-text">{formatCurrency(totalBudget)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative h-[140px] w-[140px]">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: `conic-gradient(${budgetUsageTone} ${ringPercent}%, var(--track-muted) 0)`,
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 20px), #000 calc(100% - 20px))',
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 20px), #000 calc(100% - 20px))',
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <p className={`font-display font-bold text-text ${displayPercent > 100 ? 'text-[34px]' : 'text-[38px]'}`}>
                        {displayPercent}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="min-h-[100px] bg-card sm:col-span-1 lg:col-span-1">
          <CardHeader className="mb-2">
            <CardTitle className="text-accent">連続記録日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-6xl font-bold text-text">{streakDays}日</p>
            <p className="mt-3 text-xs text-text2">{streakDays === 0 ? '今日の支出を記録しましょう' : '毎日の記録を継続中！'}</p>
          </CardContent>
        </Card>

        <Card className="min-h-[100px] bg-card sm:col-span-1 lg:col-span-1">
          <CardHeader className="mb-2">
            <CardTitle className="text-accent">連続予算達成</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-6xl font-bold text-text">{budgetAchievementStreak}ヶ月</p>
            <p className="mt-3 text-xs text-text2">予算内の支出を連続で達成した期間</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-h-[232px] bg-card">
        <CardHeader>
          <CardTitle className="text-accent">KakeAIからの提案</CardTitle>
          <Link
            href="/advice"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-card2 px-3 text-xs font-semibold text-accent transition-all hover:-translate-y-[1px] hover:bg-[var(--cta-bg)] hover:!text-white focus-visible:bg-accent focus-visible:text-white active:bg-accent active:text-white"
          >
            詳しく確認する
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {adviceLoading ? <p className="text-sm text-text2">アドバイスを読み込み中...</p> : null}
          {!adviceLoading && previewAdviceItems.length === 0 ? (
            <p className="text-sm leading-relaxed text-text2">
              アドバイスはまだありません。支出・収入の記録が増えると、傾向に合わせて提案します。
            </p>
          ) : null}
          {previewAdviceItems.map((item) => (
            <button
              key={`${item.title}-${item.body}`}
              type="button"
              onClick={() => void handleSelectPreviewAdvice(item)}
              className="block w-full rounded-xl bg-card2 p-3 text-left shadow-[0_8px_16px_rgba(35,55,95,0.08)] transition-all hover:-translate-y-[1px] hover:bg-accent/10"
              aria-label={`${item.title}の詳細を表示`}
            >
              <h3 className="text-sm font-semibold text-text">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text2">{item.body}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-accent">支出トレンド</CardTitle>
            <Tabs
              options={tabs}
              value={range}
              onValueChange={(value) => setRange(value as RangeKey)}
              ariaLabel="支出トレンド期間"
            />
          </CardHeader>
          <CardContent id={`tab-panel-${range}`} role="tabpanel">
            {trendData.length > 0 ? (
              <TrendChart data={trendData} range={range} />
            ) : (
              <div className="grid min-h-[230px] place-items-center rounded-xl border border-dashed border-border bg-card2 text-sm text-text2">
                記録はまだありません。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-accent">最近の収支記録</CardTitle>
            <Link
              href="/expense"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-card2 px-3 text-xs font-semibold text-accent transition-all hover:-translate-y-[1px] hover:bg-[var(--cta-bg)] hover:!text-white focus-visible:bg-accent focus-visible:text-white active:bg-accent active:text-white"
            >
              詳しく確認する
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {transactionsLoading ? <p className="text-sm text-text2">収支履歴を読み込み中...</p> : null}
            {!transactionsLoading && recentTransactions.length === 0 ? (
              <div className="grid min-h-[190px] place-items-center rounded-xl border border-dashed border-border bg-card2 text-sm text-text2">
                記録はまだありません。
              </div>
            ) : null}
            {recentTransactions.map((transaction) => {
              const rawAmount = Number(transaction.amount)
              const amount = Number.isFinite(rawAmount) ? rawAmount : 0
              const signedAmount = transaction.type === 'expense' ? -Math.abs(amount) : amount
              return (
                <button
                  type="button"
                  key={transaction.id}
                  className="flex w-full items-center justify-between rounded-xl bg-card2 px-3 py-2 text-sm shadow-[0_8px_16px_rgba(35,55,95,0.08)] transition-transform hover:-translate-y-[1px]"
                  onClick={() => setEditingTransaction(transaction)}
                >
                  <div>
                    <p className="font-medium text-text">{transaction.description || '（メモなし）'}</p>
                    <p className="text-xs text-text2">
                      {transaction.transacted_at} ・ {CATEGORY_LABELS[transaction.category] ?? transaction.category}
                    </p>
                  </div>
                  <p className={signedAmount < 0 ? 'text-danger' : 'text-success'}>
                    {signedAmount < 0 ? '-' : '+'}
                    {formatCurrency(Math.abs(signedAmount))}
                  </p>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">ライフプランの進捗</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.length === 0 ? (
            <div className="grid min-h-[190px] place-items-center rounded-xl border border-dashed border-border bg-card2 text-sm text-text2">
              目標がまだ登録されていません。
            </div>
          ) : null}
          {goals.map((goal) => (
            <Link
              key={goal.id}
              href="/future"
              className="block rounded-xl bg-card2 p-3 shadow-[0_8px_16px_rgba(35,55,95,0.08)] transition-all hover:-translate-y-[1px] hover:bg-accent/10"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text">{goal.title}</p>
                <p className="text-xs text-text2">{goal.target_year}年</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--track-muted)]">
                <div className="h-full rounded-full bg-accent2" style={{ width: `${goal.progress_rate * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-text2">
                {formatCurrency(goal.saved_amount)} / {formatCurrency(goal.target_amount)}
              </p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <AddExpenseModal open={expenseModalOpen} onOpenChange={setExpenseModalOpen} />
      <AddIncomeModal open={incomeModalOpen} onOpenChange={setIncomeModalOpen} />
      <EditTransactionModal
        open={Boolean(editingTransaction)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTransaction(null)
          }
        }}
        transaction={editingTransaction}
      />
      <AdviceDetailDialog detail={selectedAdvice} onOpenChange={(open) => !open && setSelectedAdvice(null)} />
    </div>
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
            <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
              <p className="text-base text-text md:text-lg">{detail.summary}</p>
            </div>
            <section className="space-y-3 pt-4">
              <h3 className="text-lg font-semibold text-text md:text-xl">具体的な提案</h3>
              {detail.isGenerating ? <p className="text-sm text-text2">KakeAIが具体案を生成中です...</p> : null}
              {detail.generationError ? <p className="text-xs text-danger">{detail.generationError}</p> : null}
              <ul className="space-y-2 pl-5 text-base text-text2 md:text-lg">
                {detail.proposalItems.map((proposal) => (
                  <li key={proposal} className="list-disc">
                    {proposal}
                  </li>
                ))}
              </ul>
            </section>
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

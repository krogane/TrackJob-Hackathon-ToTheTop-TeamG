'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { TrendChart } from '@/components/charts/TrendChart'
import { AddExpenseModal } from '@/components/modals/AddExpenseModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import { useAdvice } from '@/hooks/useAdvice'
import { useBudgets } from '@/hooks/useBudgets'
import { useGoals } from '@/hooks/useGoals'
import { useRecordingStreak, useTransactionTrend, useTransactions, useTransactionSummary } from '@/hooks/useTransactions'
import { authProfileApi } from '@/lib/api'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'

const tabs = [
  { value: '1m', label: '1ヶ月' },
  { value: '3m', label: '3ヶ月' },
  { value: '1y', label: '1年' },
]

type RangeKey = '1m' | '3m' | '1y'

type TrendPoint = {
  expense: number
  budget?: number
}

function calculateBudgetAchievementStreak(points: TrendPoint[]) {
  let streak = 0
  for (const point of points) {
    const hasBudget = typeof point.budget === 'number' && point.budget > 0
    if (!hasBudget) break
    if (point.expense <= point.budget) {
      streak += 1
      continue
    }
    break
  }
  return streak
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>('1m')
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [displayName, setDisplayName] = useState('ユーザー')

  const currentYearMonth = getCurrentYearMonth()

  const { data: currentSummary } = useTransactionSummary(currentYearMonth)
  const { budgetSummary } = useBudgets(currentYearMonth)
  const { goals } = useGoals('all')
  const { streakDays } = useRecordingStreak()
  const { transactions: recentTransactions, isLoading: transactionsLoading } = useTransactions({
    year_month: currentYearMonth,
    page: 1,
    limit: 5,
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

  const totalBudget = budgetSummary?.total_budget ?? 0
  const totalExpense = currentSummary?.total_expense ?? 0
  const expenseRate = totalExpense / Math.max(1, totalBudget)
  const overAmount = Math.max(totalExpense - totalBudget, 0)
  const ringPercent = Math.min(Math.max(expenseRate, 0), 1) * 100
  const budgetUsageTone =
    expenseRate > 0.8
      ? 'var(--danger)'
      : expenseRate > 0.5
        ? '#e9a33f'
        : 'var(--accent)'

  const guidanceMessage = useMemo(() => {
    if (expenseRate > 1) {
      return `予算を${overAmount.toLocaleString('ja-JP')}円超過しています。支出ペースの見直しが必要です。`
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
    const now = new Date()
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()]
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}年${month}月${day}日（${weekday}）`
  }, [])

  const trendData = useMemo(
    () =>
      (rawTrendData ?? []).map((point) => ({
        ...point,
        budget: budgetSummary?.total_budget ?? 0,
      })),
    [rawTrendData, budgetSummary?.total_budget],
  )

  const budgetAchievementStreak = useMemo(() => {
    const points = [...(yearlyTrendData ?? [])].reverse()
    return calculateBudgetAchievementStreak(points)
  }, [yearlyTrendData])

  const previewAdviceItems = useMemo(() => {
    if (!advice) return []
    const base = advice.content.urgent.length > 0 ? advice.content.urgent : advice.content.suggestions
    return base.slice(0, 2)
  }, [advice])

  return (
    <div className="space-y-4 pb-20 md:pb-28">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#1c3b30]">
            おかえりなさい、{displayName}さん。
          </h1>
          <p className="text-sm text-text2">
            <span className="mr-2">{todayLabel}</span>
            <span>{guidanceMessage}</span>
          </p>
        </div>
        <Button
          className="h-12 bg-[#2fbf8f] px-6 text-base font-bold text-white shadow-[0_10px_20px_rgba(47,191,143,0.24)] hover:bg-[#24b47e]"
          onClick={() => setExpenseModalOpen(true)}
        >
          ＋ 支出を追加
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/expense" className="block sm:col-span-2 lg:col-span-2">
          <Card className="min-h-[220px] cursor-pointer transition-transform hover:-translate-y-[1px]">
            <CardContent className="h-full">
              <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-[#2fbf8f]">今月の支出</p>
                    <p className="font-display text-[34px] font-bold tracking-[-0.02em] text-text">{formatCurrency(totalExpense)}</p>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-[#2fbf8f]">今月の予算</p>
                    <p className="font-display text-[34px] font-bold tracking-[-0.02em] text-text">{formatCurrency(totalBudget)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative h-[140px] w-[140px]">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: `conic-gradient(${budgetUsageTone} ${ringPercent}%, rgba(47,191,143,0.14) 0)`,
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 20px), #000 calc(100% - 20px))',
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 20px), #000 calc(100% - 20px))',
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <p className="font-display text-[38px] font-bold text-text">{Math.round(expenseRate * 100)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="min-h-[100px] sm:col-span-1 lg:col-span-1">
          <CardHeader className="mb-2">
            <CardTitle className="text-[#2fbf8f]">連続記録日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-6xl font-bold text-text">{streakDays}日</p>
            <p className="mt-3 text-s text-text2">毎日の記録を継続中！</p>
          </CardContent>
        </Card>

        <Card className="min-h-[100px] sm:col-span-1 lg:col-span-1">
          <CardHeader className="mb-2">
            <CardTitle className="text-[#2fbf8f]">連続予算達成</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-6xl font-bold text-text">{budgetAchievementStreak}ヶ月</p>
            <p className="mt-3 text-s text-text2">予算内で推移した連続月数</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-h-[232px]">
        <CardHeader>
          <CardTitle className="text-[#2fbf8f]">KakeAIからの提案</CardTitle>
          <Link
            href="/advice"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-card2 px-3 text-xs font-semibold text-[#2fbf8f] transition-all hover:-translate-y-[1px] hover:bg-[#2fbf8f] hover:text-white focus-visible:bg-[#2fbf8f] focus-visible:text-white active:bg-[#2fbf8f] active:text-white"
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
            <Link
              key={item.title}
              href="/advice"
              className="block rounded-xl bg-card2 p-3 shadow-[0_8px_16px_rgba(35,55,95,0.08)] transition-all hover:-translate-y-[1px] hover:bg-accent/10"
            >
              <h3 className="text-sm font-semibold text-text">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text2">{item.body}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-[#2fbf8f]">支出トレンド</CardTitle>
            <Tabs
              options={tabs}
              value={range}
              onValueChange={(value) => setRange(value as RangeKey)}
              ariaLabel="支出トレンド期間"
            />
          </CardHeader>
          <CardContent id={`tab-panel-${range}`} role="tabpanel">
            {trendData.length > 0 ? (
              <TrendChart data={trendData} />
            ) : (
              <div className="grid min-h-[230px] place-items-center rounded-xl border border-dashed border-border bg-[#fbfffd] text-sm text-text2">
                記録はまだありません。
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#2fbf8f]">最近の収支記録</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {transactionsLoading ? <p className="text-sm text-text2">取引履歴を読み込み中...</p> : null}
            {!transactionsLoading && recentTransactions.length === 0 ? (
              <div className="grid min-h-[190px] place-items-center rounded-xl border border-dashed border-border bg-[#fbfffd] text-sm text-text2">
                記録はまだありません。
              </div>
            ) : null}
            {recentTransactions.map((transaction) => {
              const signedAmount = transaction.type === 'expense' ? -Math.abs(transaction.amount) : transaction.amount
              return (
                <Link
                  key={transaction.id}
                  href="/expense"
                  className="flex items-center justify-between rounded-xl bg-card2 px-3 py-2 text-sm shadow-[0_8px_16px_rgba(35,55,95,0.08)] transition-transform hover:-translate-y-[1px]"
                >
                  <div>
                    <p className="font-medium text-text">{transaction.description || '（メモなし）'}</p>
                    <p className="text-xs text-text2">{transaction.transacted_at}</p>
                  </div>
                  <p className={signedAmount < 0 ? 'text-danger' : 'text-success'}>
                    {signedAmount > 0 ? '+' : ''}
                    {formatCurrency(signedAmount)}
                  </p>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#2fbf8f]">ライフプランの進捗</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.length === 0 ? (
            <div className="grid min-h-[190px] place-items-center rounded-xl border border-dashed border-border bg-[#fbfffd] text-sm text-text2">
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
                <p className="text-sm font-semibold text-text">
                  {goal.icon} {goal.title}
                </p>
                <p className="text-xs text-text2">{goal.target_year}年</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[rgba(47,74,122,0.12)]">
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
    </div>
  )
}

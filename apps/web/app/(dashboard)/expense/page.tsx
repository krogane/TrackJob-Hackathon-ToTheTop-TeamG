'use client'

import { useMemo, useState } from 'react'

import type { Transaction, TransactionCategory } from '@lifebalance/shared/types'

import { ExpensePieChart } from '@/components/charts/ExpensePieChart'
import { AddExpenseModal } from '@/components/modals/AddExpenseModal'
import { AddIncomeModal } from '@/components/modals/AddIncomeModal'
import { EditTransactionModal } from '@/components/modals/EditTransactionModal'
import { ExportTransactionsModal } from '@/components/modals/ExportTransactionsModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useBudgets } from '@/hooks/useBudgets'
import { useTransactions, useTransactionSummary } from '@/hooks/useTransactions'
import { useToast } from '@/hooks/useToast'
import { transactionsApi } from '@/lib/api'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'

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

const PIE_COLORS = [
  'var(--pie-1)',
  'var(--pie-2)',
  'var(--pie-3)',
  'var(--pie-4)',
  'var(--pie-5)',
  'var(--pie-6)',
  'var(--pie-7)',
  'var(--pie-8)',
  'var(--pie-9)',
]
const HEADER_ACTION_BUTTON_CLASS =
  'h-12 bg-[var(--cta-bg)] px-6 text-base font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] hover:bg-[var(--cta-hover)]'
const SECONDARY_ACTION_BUTTON_CLASS = 'h-12 px-6 text-base font-bold'

function toCsvCell(value: string | number) {
  const raw = String(value ?? '')
  const escaped = raw.replace(/"/g, '""')
  return `"${escaped}"`
}

function getRecentMonths(count: number) {
  const months: string[] = []
  const now = new Date()

  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return months
}

export default function ExpensePage() {
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openIncomeModal, setOpenIncomeModal] = useState(false)
  const [openExportModal, setOpenExportModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | TransactionCategory>('all')
  const [month, setMonth] = useState(getCurrentYearMonth())
  const { toast } = useToast()

  const { transactions, pagination, isLoading: transactionsLoading, error: transactionsError } = useTransactions({
    year_month: month,
    category: category === 'all' ? undefined : category,
    keyword: query.trim() || undefined,
    page: 1,
    limit: 50,
    order: 'desc',
    sort: 'transacted_at',
  })

  const { budgetSummary, budgets, isLoading: budgetsLoading } = useBudgets(month)
  const { data: summary, isLoading: summaryLoading } = useTransactionSummary(month)

  const pieData = useMemo(
    () =>
      (summary?.by_category ?? [])
        .map((item) => {
          const value = Math.abs(Number(item.amount) || 0)
          return {
            name: CATEGORY_LABELS[item.category] ?? item.category,
            value,
          }
        })
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
          ...item,
          color: PIE_COLORS[index % PIE_COLORS.length],
        })),
    [summary],
  )

  const totalPieAmount = useMemo(() => pieData.reduce((sum, item) => sum + item.value, 0), [pieData])
  const monthOptions = useMemo(() => getRecentMonths(6), [])

  async function handleDownloadCsv() {
    setIsExporting(true)

    try {
      const rows: Awaited<ReturnType<typeof transactionsApi.list>>['data'] = []
      let page = 1
      const limit = 100

      while (true) {
        const response = await transactionsApi.list({
          year_month: 'all',
          type: 'expense',
          page,
          limit,
          order: 'desc',
          sort: 'transacted_at',
        })

        rows.push(...response.data)

        if (!response.pagination?.has_next) {
          break
        }
        page += 1
      }

      const header = ['id', 'type', 'category', 'title', 'amount', 'transacted_at', 'source', 'created_at']
      const records = rows.map((transaction) => [
        transaction.id,
        transaction.type,
        transaction.category,
        transaction.description ?? '',
        transaction.amount,
        transaction.transacted_at,
        transaction.source,
        transaction.created_at,
      ])
      const csv = [header, ...records].map((line) => line.map((cell) => toCsvCell(cell)).join(',')).join('\n')

      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')

      link.href = url
      link.download = `expense-data-${date}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setOpenExportModal(false)
      toast({ title: '支出データをダウンロードしました。', variant: 'success' })
    } catch (error) {
      toast({
        title: error instanceof Error ? `CSVの作成に失敗しました: ${error.message}` : 'CSVの作成に失敗しました。',
        variant: 'error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-5 pb-20 md:pb-28">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold">収支管理</h1>
          <p className="text-sm text-text2">カテゴリ別の支出や収支履歴を確認しましょう。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className={SECONDARY_ACTION_BUTTON_CLASS}
            onClick={() => {
              setOpenExportModal(true)
            }}
          >
            支出データを保存
          </Button>
          <Button className={HEADER_ACTION_BUTTON_CLASS} onClick={() => setOpenIncomeModal(true)}>
            ＋ 収入を追加
          </Button>
          <Button className={HEADER_ACTION_BUTTON_CLASS} onClick={() => setOpenAddModal(true)}>
            ＋ 支出を追加
          </Button>
        </div>
      </div>

      <Card className="bg-card">
        <CardHeader className="mb-2 flex-col items-start gap-1">
          <CardTitle className="text-accent">KakeAIによる分析</CardTitle>
          <p className="text-sm text-text2">今月の支出傾向をもとにしたモック分析です。実データ連携は次フェーズで対応します。</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-card2 p-3">
              <p className="text-xs font-semibold text-text2">気になる傾向</p>
              <p className="mt-1 text-sm font-semibold text-text">平日ランチ支出が週後半に増加</p>
            </div>
            <div className="rounded-xl bg-card2 p-3">
              <p className="text-xs font-semibold text-text2">改善アイデア</p>
              <p className="mt-1 text-sm font-semibold text-text">週2回を上限に外食日を固定すると安定</p>
            </div>
            <div className="rounded-xl bg-card2 p-3">
              <p className="text-xs font-semibold text-text2">次アクション</p>
              <p className="mt-1 text-sm font-semibold text-text">次月は食費カテゴリを毎週チェック</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-accent">カテゴリ別支出（{month}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {budgetsLoading ? <p className="text-sm text-text2">予算データを読み込み中...</p> : null}
            {budgets.map((budget) => (
              <div
                key={budget.id}
                className="grid grid-cols-[7.5rem_17rem_1fr] items-center gap-3 border-b border-border py-2 text-sm last:border-none md:grid-cols-[7.5rem_18rem_1fr]"
              >
                <p className="truncate">{CATEGORY_LABELS[budget.category]}</p>
                <div className="h-2 rounded-full bg-[var(--track-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(Math.max(budget.usage_rate * 100, 0), 100)}%`,
                      background:
                        budget.usage_rate >= 1 ? 'var(--danger)' : budget.usage_rate >= 0.8 ? 'var(--warn)' : 'var(--accent)',
                      opacity: budget.spent_amount === 0 ? 0.3 : 1,
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-3">
                  <p className="min-w-[9.5rem] text-right text-xs text-text2">
                    {formatCurrency(budget.spent_amount)} / {formatCurrency(budget.limit_amount)}
                  </p>
                  <p className="w-12 text-right text-xs text-text2">{Math.round(budget.usage_rate * 100)}%</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-accent">支出構成</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? <p className="text-sm text-text2">集計を読み込み中...</p> : null}
            {!summaryLoading && pieData.length > 0 ? <ExpensePieChart data={pieData} /> : null}
            {!summaryLoading && pieData.length === 0 ? <p className="text-sm text-text2">データがありません。</p> : null}
            {pieData.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {pieData.map((item) => {
                  const pct = totalPieAmount > 0 ? Math.round((item.value / totalPieAmount) * 100) : 0
                  return (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: item.color }} />
                      <span className="flex-1 text-text">{item.name}</span>
                      <span className="text-text2">{formatCurrency(item.value)}</span>
                      <span className="w-9 text-right font-medium text-text">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            ) : null}
            <p className="mt-3 text-center text-xs text-text2">
              合計支出: {formatCurrency(summary?.total_expense ?? 0)} / 予算: {formatCurrency(budgetSummary?.total_budget ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader className="mb-3 flex-col items-start gap-3">
          <CardTitle className="text-accent">収支履歴</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button className={HEADER_ACTION_BUTTON_CLASS} onClick={() => setOpenIncomeModal(true)}>
              ＋ 収入を追加
            </Button>
            <Button className={HEADER_ACTION_BUTTON_CLASS} onClick={() => setOpenAddModal(true)}>
              ＋ 支出を追加
            </Button>
          </div>

          <div className="w-full rounded-xl border border-border bg-card2 p-3">
            <p className="mb-2 text-xs font-semibold text-text2">検索条件</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-text2" htmlFor="history-month">
                  期間:
                </label>
                <Select id="history-month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="対象月">
                  {monthOptions.map((monthOption) => (
                    <option key={monthOption} value={monthOption}>
                      {monthOption}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text2" htmlFor="history-category">
                  カテゴリ:
                </label>
                <Select
                  id="history-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as 'all' | TransactionCategory)}
                  aria-label="カテゴリ"
                >
                  <option value="all">すべて</option>
                  <option value="housing">住居費</option>
                  <option value="food">食費</option>
                  <option value="transport">交通費</option>
                  <option value="entertainment">娯楽</option>
                  <option value="clothing">衣類</option>
                  <option value="communication">通信</option>
                  <option value="medical">医療</option>
                  <option value="social">交際費</option>
                  <option value="other">その他</option>
                  <option value="salary">給与</option>
                  <option value="bonus">賞与</option>
                  <option value="side_income">副収入</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-text2" htmlFor="history-keyword">
                  キーワード:
                </label>
                <Input
                  id="history-keyword"
                  placeholder="例: ランチ"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="検索"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-text2">
            表示中の月: {month}
            {pagination ? ` / ${pagination.total}件` : ''}
          </p>
          {transactionsLoading ? <p className="text-sm text-text2">収支履歴を読み込み中...</p> : null}
          {transactionsError ? <p className="text-sm text-danger">収支履歴の取得に失敗しました。</p> : null}

          {!transactionsLoading && transactions.length === 0 ? (
            <p className="text-sm text-text2">条件に一致する取引がありません。</p>
          ) : null}

          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border py-2 last:border-none"
            >
              <div>
                <p className="text-sm font-medium">{transaction.description || '（メモなし）'}</p>
                <p className="text-xs text-text2">{transaction.transacted_at}</p>
              </div>
              <Badge variant={transaction.type === 'expense' ? 'warning' : 'success'}>{CATEGORY_LABELS[transaction.category]}</Badge>
              <p className={transaction.type === 'expense' ? 'text-sm text-danger' : 'text-sm text-success'}>
                {transaction.type === 'expense' ? '-' : '+'}
                {formatCurrency(transaction.amount)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-semibold"
                onClick={() => {
                  setEditingTransaction(transaction)
                }}
              >
                編集
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddExpenseModal open={openAddModal} onOpenChange={setOpenAddModal} />
      <AddIncomeModal open={openIncomeModal} onOpenChange={setOpenIncomeModal} />
      <ExportTransactionsModal
        open={openExportModal}
        onOpenChange={setOpenExportModal}
        onDownload={handleDownloadCsv}
        isDownloading={isExporting}
      />
      <EditTransactionModal
        open={Boolean(editingTransaction)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTransaction(null)
          }
        }}
        transaction={editingTransaction}
      />
    </div>
  )
}

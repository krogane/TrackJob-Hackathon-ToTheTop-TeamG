'use client'

import { BudgetEditForm } from '@/components/forms/BudgetEditForm'
import { BudgetInitForm } from '@/components/forms/BudgetInitForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBudgets, usePatchBudget, useUpdateBudgets } from '@/hooks/useBudgets'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'

export default function BudgetPage() {
  const yearMonth = getCurrentYearMonth()

  const { budgetSummary, budgets, isLoading: budgetsLoading, error: budgetsError } = useBudgets(yearMonth)
  const patchBudget = usePatchBudget(yearMonth)
  const updateBudgets = useUpdateBudgets()

  return (
    <div className="space-y-5 pb-20 md:pb-28">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">予算設定</h1>
        <p className="text-sm text-text2">月次予算をカテゴリごとに調整できます</p>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">予算総額</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-end">
            <div>
              <p className="text-xs text-text2">対象月（{yearMonth}）</p>
              <p className="font-display text-4xl font-bold">{formatCurrency(budgetSummary?.total_budget ?? 0)}</p>
            </div>
            <p className="text-xs text-text2">設定カテゴリ数: {budgets.length}件</p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {budgetsLoading ? <p className="text-sm text-text2">予算データを読み込み中...</p> : null}
        {budgetsError ? <p className="text-sm text-danger">予算データの取得に失敗しました。</p> : null}

        {!budgetsLoading && !budgetsError && budgets.length === 0 ? (
          <BudgetInitForm
            yearMonth={yearMonth}
            onSave={(payload) => updateBudgets.mutateAsync(payload)}
            isSaving={updateBudgets.isPending}
          />
        ) : null}

        {!budgetsLoading && !budgetsError && budgets.length > 0 ? (
          <BudgetEditForm
            items={budgets}
            onSaveItem={(payload) => patchBudget.mutateAsync(payload)}
            savingItemId={patchBudget.isPending ? patchBudget.variables?.id ?? null : null}
          />
        ) : null}
      </section>
    </div>
  )
}

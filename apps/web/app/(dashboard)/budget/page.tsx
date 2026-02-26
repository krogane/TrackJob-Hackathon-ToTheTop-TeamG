'use client'

import { BudgetEditForm } from '@/components/forms/BudgetEditForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBudgets, usePatchBudget } from '@/hooks/useBudgets'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'
import { useChatWizardStore } from '@/stores/chatWizardStore'

const SECONDARY_ACTION_BUTTON_CLASS = 'h-12 px-6 text-base font-bold'

export default function BudgetPage() {
  const openChatWizard = useChatWizardStore((state) => state.open)
  const yearMonth = getCurrentYearMonth()

  const { budgetSummary, budgets, isLoading: budgetsLoading, error: budgetsError } = useBudgets(yearMonth)
  const patchBudget = usePatchBudget(yearMonth)

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">予算設定</h1>
          <p className="text-sm text-text2">月次予算をカテゴリごとに調整できます</p>
        </div>
        <Button variant="ghost" className={SECONDARY_ACTION_BUTTON_CLASS} onClick={() => openChatWizard('budget')}>
          🤖 KakeAIチャットで再設定
        </Button>
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

        {!budgetsLoading && !budgetsError ? (
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

'use client'

import { useMemo, useState } from 'react'

import { BudgetEditForm } from '@/components/forms/BudgetEditForm'
import { AddGoalModal } from '@/components/modals/AddGoalModal'
import { EditGoalModal } from '@/components/modals/EditGoalModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBudgets, usePatchBudget, useUpdateBudgets } from '@/hooks/useBudgets'
import { useDeleteGoal, useGoals } from '@/hooks/useGoals'
import { formatCurrency, getCurrentYearMonth } from '@/lib/utils'
import { useChatWizardStore } from '@/stores/chatWizardStore'

const PRIMARY_ACTION_BUTTON_CLASS =
  'h-12 bg-[var(--cta-bg)] px-6 text-base font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] hover:bg-[var(--cta-hover)]'
const SECONDARY_ACTION_BUTTON_CLASS = 'h-12 px-6 text-base font-bold'

export default function BudgetPage() {
  const openChatWizard = useChatWizardStore((state) => state.open)
  const yearMonth = getCurrentYearMonth()

  const [openAddGoal, setOpenAddGoal] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)

  const { budgetSummary, budgets, isLoading: budgetsLoading, error: budgetsError } = useBudgets(yearMonth)
  const { goals, isLoading: goalsLoading, error: goalsError } = useGoals('all')

  const patchBudget = usePatchBudget(yearMonth)
  const updateBudgets = useUpdateBudgets()
  const deleteGoal = useDeleteGoal()

  const savingTarget = useMemo(
    () => goals.reduce((sum, goal) => sum + Math.max(0, goal.monthly_saving), 0),
    [goals],
  )

  const editingGoal = useMemo(() => goals.find((goal) => goal.id === editingGoalId) ?? null, [editingGoalId, goals])

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">予算・目標管理</h1>
          <p className="text-sm text-text2">月次予算とライフプラン目標を調整できます</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className={SECONDARY_ACTION_BUTTON_CLASS} onClick={() => openChatWizard('budget')}>
            🤖 チャットで再設定
          </Button>
          <Button className={PRIMARY_ACTION_BUTTON_CLASS} onClick={() => setOpenAddGoal(true)}>
            ＋ 目標を追加
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-accent">月次予算設定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card2 p-4">
              <div>
                <p className="text-xs text-text2">予算総額（{yearMonth}）</p>
                <p className="font-display text-2xl font-bold">{formatCurrency(budgetSummary?.total_budget ?? 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text2">月貯蓄目標（目標合計）</p>
                <p className="font-display text-2xl font-bold text-accent">{formatCurrency(savingTarget)}</p>
              </div>
            </div>

            {budgetsLoading ? <p className="text-sm text-text2">予算データを読み込み中...</p> : null}
            {budgetsError ? <p className="text-sm text-danger">予算データの取得に失敗しました。</p> : null}

            {!budgetsLoading && !budgetsError ? (
              <BudgetEditForm
                items={budgets}
                onSaveItem={(payload) => patchBudget.mutateAsync(payload)}
                onSaveAll={(payload) =>
                  updateBudgets.mutateAsync({
                    year_month: yearMonth,
                    budgets: payload.budgets,
                  })
                }
                savingItemId={patchBudget.isPending ? patchBudget.variables?.id ?? null : null}
                savingAll={updateBudgets.isPending}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-accent">ライフプラン目標</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {goalsLoading ? <p className="text-sm text-text2">目標データを読み込み中...</p> : null}
            {goalsError ? <p className="text-sm text-danger">目標データの取得に失敗しました。</p> : null}

            {!goalsLoading && goals.length === 0 ? <p className="text-sm text-text2">目標がまだ登録されていません。</p> : null}

            {goals.map((goal) => (
              <div key={goal.id} className="rounded-xl border border-border bg-card2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {goal.icon} {goal.title}
                  </p>
                  <Badge variant={goal.priority === '高' ? 'danger' : goal.priority === '中' ? 'warning' : 'success'}>
                    {goal.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text2">
                  {goal.target_year}年 / {formatCurrency(goal.saved_amount)} / {formatCurrency(goal.target_amount)}
                </p>
                <div className="mt-2 h-2 rounded-full bg-[var(--track-muted)]">
                  <div className="h-full rounded-full bg-accent2" style={{ width: `${goal.progress_rate * 100}%` }} />
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingGoalId(goal.id)}>
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteGoal.isPending}
                    onClick={() => {
                      const ok = window.confirm('この目標を削除しますか？')
                      if (!ok) return
                      void deleteGoal.mutateAsync(goal.id)
                    }}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <AddGoalModal open={openAddGoal} onOpenChange={setOpenAddGoal} />
      <EditGoalModal
        open={Boolean(editingGoal)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGoalId(null)
          }
        }}
        goal={editingGoal}
      />
    </div>
  )
}

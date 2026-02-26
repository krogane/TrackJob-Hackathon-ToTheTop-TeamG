'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SimulationResult } from '@lifebalance/shared/types'

import { GaugeChart } from '@/components/charts/GaugeChart'
import { ProjectionChart } from '@/components/charts/ProjectionChart'
import { AddGoalModal } from '@/components/modals/AddGoalModal'
import { EditGoalModal } from '@/components/modals/EditGoalModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useAssumptions, useUpdateAssumptions } from '@/hooks/useAssumptions'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDeleteGoal, useGoals } from '@/hooks/useGoals'
import { useScenarioSimulation, useSimulation } from '@/hooks/useSimulation'
import { simulationResult as fallbackSimulationResult } from '@/lib/mocks'
import { formatCurrency } from '@/lib/utils'

type AssumptionFormState = {
  age: number
  annual_income_growth: number
  investment_return: number
  inflation_rate: number
  monthly_investment: number
  simulation_trials: 100 | 500 | 1000
}

const PRIMARY_ACTION_BUTTON_CLASS =
  'h-12 bg-[var(--cta-bg)] px-6 text-base font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] hover:bg-[var(--cta-hover)]'

function toState(assumption: {
  age: number
  annual_income_growth: number
  investment_return: number
  inflation_rate: number
  monthly_investment: number
  simulation_trials: 100 | 500 | 1000
}): AssumptionFormState {
  return {
    age: assumption.age,
    annual_income_growth: assumption.annual_income_growth,
    investment_return: assumption.investment_return,
    inflation_rate: assumption.inflation_rate,
    monthly_investment: assumption.monthly_investment,
    simulation_trials: assumption.simulation_trials,
  }
}

function isSameAssumptionState(a: AssumptionFormState, b: AssumptionFormState) {
  return (
    a.age === b.age &&
    a.annual_income_growth === b.annual_income_growth &&
    a.investment_return === b.investment_return &&
    a.inflation_rate === b.inflation_rate &&
    a.monthly_investment === b.monthly_investment &&
    a.simulation_trials === b.simulation_trials
  )
}

export default function FuturePage() {
  const { assumptions, isLoading, error } = useAssumptions()
  const { goals, isLoading: goalsLoading, error: goalsError } = useGoals('all')
  const updateAssumptions = useUpdateAssumptions()
  const runSimulation = useSimulation()
  const scenarioSimulation = useScenarioSimulation()
  const deleteGoal = useDeleteGoal()

  const [assumption, setAssumption] = useState<AssumptionFormState | null>(null)
  const [simulationStatus, setSimulationStatus] = useState('')
  const [openAddGoal, setOpenAddGoal] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)

  useEffect(() => {
    if (!assumptions) return
    setAssumption(toState(assumptions))
  }, [assumptions])

  const debouncedAssumption = useDebouncedValue(assumption, 500)

  useEffect(() => {
    if (!assumptions || !debouncedAssumption) {
      return
    }

    const serverState = toState(assumptions)
    if (isSameAssumptionState(serverState, debouncedAssumption)) {
      return
    }

    setSimulationStatus('前提条件を保存しています...')

    Promise.all([
      updateAssumptions.mutateAsync(debouncedAssumption),
      scenarioSimulation.mutateAsync(debouncedAssumption),
    ])
      .then(() => {
        setSimulationStatus('前提条件を更新し、シミュレーションを再計算しました。')
      })
      .catch(() => {
        setSimulationStatus('前提条件またはシミュレーションの更新に失敗しました。')
      })
  }, [assumptions, debouncedAssumption, scenarioSimulation, updateAssumptions])

  const editingGoal = useMemo(() => goals.find((goal) => goal.id === editingGoalId) ?? null, [editingGoalId, goals])

  const displayState = useMemo(
    () =>
      assumption ?? {
        age: 30,
        annual_income_growth: 3,
        investment_return: 5,
        inflation_rate: 2,
        monthly_investment: 15000,
        simulation_trials: 1000 as const,
      },
    [assumption],
  )

  const displaySimulation: SimulationResult = useMemo(
    () => scenarioSimulation.data ?? runSimulation.data ?? fallbackSimulationResult,
    [runSimulation.data, scenarioSimulation.data],
  )

  const scenarioRows = useMemo(() => {
    const baseProbability = displaySimulation.goal_probabilities[0]?.probability ?? 0
    const baseInvestment = displayState.monthly_investment

    return [
      { name: '現状維持', probability: baseProbability, monthlyInvestment: baseInvestment },
      { name: '食費削減', probability: Math.min(baseProbability + 0.08, 1), monthlyInvestment: baseInvestment + 5000 },
      { name: '副収入', probability: Math.min(baseProbability + 0.18, 1), monthlyInvestment: baseInvestment + 15000 },
      { name: '悲観', probability: Math.max(baseProbability - 0.18, 0), monthlyInvestment: Math.max(0, baseInvestment - 5000) },
    ]
  }, [displaySimulation.goal_probabilities, displayState.monthly_investment])

  const targetLine = displaySimulation.goal_probabilities[0]?.target_amount ?? 5000000

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">ライフプラン</h1>
          <p className="text-sm text-text2">目標管理と将来シミュレーションをまとめて確認できます</p>
        </div>
        <Button className={PRIMARY_ACTION_BUTTON_CLASS} onClick={() => setOpenAddGoal(true)}>
          ＋ 目標を追加
        </Button>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">ライフプラン目標</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goalsLoading ? <p className="text-sm text-text2">目標データを読み込み中...</p> : null}
          {goalsError ? <p className="text-sm text-danger">目標データの取得に失敗しました。</p> : null}

          {!goalsLoading && goals.length === 0 ? <p className="text-sm text-text2">目標がまだ登録されていません。</p> : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {goals.map((goal) => {
              const progressPercent = Math.min(Math.max(goal.progress_rate * 100, 0), 100)

              return (
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
                  <p className="mt-1 text-xs text-text2">月積立: {formatCurrency(goal.monthly_saving)}</p>
                  <div className="mt-2 h-2 rounded-full bg-[var(--track-muted)]">
                    <div className="h-full rounded-full bg-accent2" style={{ width: `${progressPercent}%` }} />
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
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">前提条件</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {isLoading ? <p className="text-sm text-text2 md:col-span-2">前提条件を読み込み中...</p> : null}
          {error ? <p className="text-sm text-danger md:col-span-2">前提条件の取得に失敗しました。</p> : null}

          <SliderField
            label="年齢"
            value={displayState.age}
            min={18}
            max={100}
            onChange={(value) => setAssumption((prev) => ({ ...(prev ?? displayState), age: value }))}
          />
          <SliderField
            label="年収上昇率(%)"
            value={displayState.annual_income_growth}
            min={-10}
            max={30}
            step={0.1}
            onChange={(value) =>
              setAssumption((prev) => ({
                ...(prev ?? displayState),
                annual_income_growth: value,
              }))
            }
          />
          <SliderField
            label="投資利回り(%)"
            value={displayState.investment_return}
            min={-10}
            max={30}
            step={0.1}
            onChange={(value) =>
              setAssumption((prev) => ({
                ...(prev ?? displayState),
                investment_return: value,
              }))
            }
          />
          <SliderField
            label="インフレ率(%)"
            value={displayState.inflation_rate}
            min={0}
            max={20}
            step={0.1}
            onChange={(value) => setAssumption((prev) => ({ ...(prev ?? displayState), inflation_rate: value }))}
          />
          <SliderField
            label="月投資額"
            value={displayState.monthly_investment}
            min={0}
            max={200000}
            step={1000}
            onChange={(value) => setAssumption((prev) => ({ ...(prev ?? displayState), monthly_investment: value }))}
          />
          <div className="self-end">
            {runSimulation.isLoading ? <p className="text-xs text-text2">初回シミュレーションを読み込み中...</p> : null}
            {runSimulation.error ? <p className="text-xs text-[var(--warn-text)]">シミュレーションAPI取得に失敗したため、表示はフォールバック値です。</p> : null}
            <p className="text-xs text-accent2">{simulationStatus}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {displaySimulation.goal_probabilities.map((goal) => (
          <Card key={goal.goal_id} className="bg-card">
            <CardHeader>
              <CardTitle className="text-accent">{goal.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <GaugeChart value={goal.probability} label={`${goal.target_year}年までの達成確率`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">資産推移シミュレーション</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectionChart data={displaySimulation.yearly_projections} targetLine={targetLine} />
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">シナリオ比較</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text2">
                  <th className="py-2">シナリオ</th>
                  <th className="py-2">達成確率</th>
                  <th className="py-2">月投資額</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map((scenario) => (
                  <tr key={scenario.name} className="border-b border-border/60">
                    <td className="py-2">{scenario.name}</td>
                    <td className="py-2">{Math.round(scenario.probability * 100)}%</td>
                    <td className="py-2">¥{scenario.monthlyInvestment.toLocaleString('ja-JP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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

function SliderField({
  label,
  value,
  min,
  max,
  step,
  ariaLabel,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  ariaLabel?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text2">{label}</p>
        <p className="font-display text-base font-semibold text-accent">{value}</p>
      </div>
      <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} aria-label={ariaLabel ?? label} />
    </div>
  )
}

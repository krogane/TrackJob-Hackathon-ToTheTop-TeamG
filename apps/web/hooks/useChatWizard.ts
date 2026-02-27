'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  ChatMessage,
  ChatSetupContext,
  ChatWizardConfig,
  ChatWizardGoalConfig,
} from '@lifebalance/shared/types'

import { ApiError, authProfileApi, budgetsApi, chatApi, goalsApi } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

const EXPENSE_CATEGORIES = [
  'housing',
  'food',
  'transport',
  'entertainment',
  'clothing',
  'communication',
  'medical',
  'social',
  'other',
] as const

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
type WizardMode = 'ai' | 'fallback'

type FallbackDraft = {
  event_title?: string
  target_year?: number | 'unknown'
  target_amount?: number | 'unknown'
  monthly_savings_target?: number
  saving_intent?: string
  priority?: '高' | '中' | '低' | 'unknown'
}

type FallbackState = {
  step: number
  draft: FallbackDraft
}

const FALLBACK_QUESTIONS = [
  '最重要ライフイベントを教えてください。例: マイホーム / 結婚・育児 / FIRE / 留学',
  '目標年と目標金額を教えてください。不明な場合は unknown と入力できます。例: 2030年 500万円',
  '月々の貯蓄目標額を教えてください。例: 6万円',
  '節約の意思を教えてください。例: 強め / 普通 / ゆるく',
] as const

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'model',
    content: 'こんにちは。初期設定を進めます。最重要ライフイベントを教えてください。',
  },
]

const INITIAL_FALLBACK_STATE: FallbackState = {
  step: 0,
  draft: {},
}

const FINISH_PHRASE = 'これで記録を終了します'

function getCurrentYearMonth() {
  return new Date().toISOString().slice(0, 7)
}

function getCurrentYear() {
  return new Date().getUTCFullYear()
}

function toNonNegativeInt(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.max(0, Math.round(parsed))
}

function normalizeSetupContext(setupContext: ChatSetupContext | null): ChatSetupContext | null {
  if (!setupContext) return null

  const monthlyIncome = toNonNegativeInt(setupContext.monthly_income)
  const currentSavings = toNonNegativeInt(setupContext.current_savings)
  const housingCost = toNonNegativeInt(setupContext.housing_cost)
  const dailyFoodCost = toNonNegativeInt(setupContext.daily_food_cost)

  return {
    ...(monthlyIncome === null ? {} : { monthly_income: monthlyIncome }),
    ...(currentSavings === null ? {} : { current_savings: currentSavings }),
    ...(housingCost === null ? {} : { housing_cost: housingCost }),
    ...(dailyFoodCost === null ? {} : { daily_food_cost: dailyFoodCost }),
  }
}

function parseAmount(value: string, preferManWhenSmall = false) {
  const manMatch = value.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*万/)
  if (manMatch?.[1]) {
    const amount = Number(manMatch[1].replace(/,/g, ''))
    return Number.isFinite(amount) ? Math.round(amount * 10000) : null
  }

  const numberMatch = value.match(/[0-9][0-9,]*/)
  if (!numberMatch) {
    return null
  }

  const parsed = Number(numberMatch[0].replace(/,/g, ''))
  if (!Number.isFinite(parsed)) {
    return null
  }

  if (preferManWhenSmall && parsed < 1000) {
    return Math.round(parsed * 10000)
  }

  return Math.round(parsed)
}

function parseTargetYear(value: string) {
  const absoluteYear = value.match(/\b(20[2-9][0-9])\b/)
  if (absoluteYear?.[1]) {
    return Number(absoluteYear[1])
  }

  const relativeYear = value.match(/([0-9]{1,2})\s*年後/)
  if (relativeYear?.[1]) {
    return getCurrentYear() + Number(relativeYear[1])
  }

  return null
}

function parseUnknown(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized.includes('unknown') || normalized.includes('不明') || normalized.includes('未定')
}

function resolvePriorityFromIntent(intent: string): '高' | '中' | '低' | 'unknown' {
  const normalized = intent.trim().toLowerCase()
  if (!normalized) return 'unknown'

  if (
    normalized.includes('強') ||
    normalized.includes('本気') ||
    normalized.includes('かなり') ||
    normalized.includes('徹底')
  ) {
    return '高'
  }

  if (normalized.includes('ゆる') || normalized.includes('弱') || normalized.includes('ほどほど')) {
    return '低'
  }

  if (normalized.includes('普通') || normalized.includes('中') || normalized.includes('バランス')) {
    return '中'
  }

  return 'unknown'
}

function buildSuggestedBudgets(
  setupContext: ChatSetupContext | null,
  monthlyIncome: number,
  monthlySavingsTarget: number,
) {
  const housingCost = setupContext?.housing_cost
  const dailyFoodCost = setupContext?.daily_food_cost

  const housing = housingCost !== undefined
    ? Math.max(0, Math.round(housingCost))
    : monthlyIncome > 0
      ? Math.round(monthlyIncome * 0.25)
      : 0

  const food = dailyFoodCost !== undefined
    ? Math.max(0, Math.round(dailyFoodCost * 30))
    : monthlyIncome > 0
      ? Math.round(monthlyIncome * 0.12)
      : 0

  const spendingUpperBound = monthlyIncome > 0 ? Math.max(0, monthlyIncome - monthlySavingsTarget) : 0
  const remaining = Math.max(0, spendingUpperBound - housing - food)

  const variableWeights: Record<Exclude<ExpenseCategory, 'housing' | 'food'>, number> = {
    transport: 0.14,
    entertainment: 0.18,
    clothing: 0.12,
    communication: 0.14,
    medical: 0.1,
    social: 0.16,
    other: 0.16,
  }

  const suggested: Record<ExpenseCategory, number> = {
    housing,
    food,
    transport: 0,
    entertainment: 0,
    clothing: 0,
    communication: 0,
    medical: 0,
    social: 0,
    other: 0,
  }

  for (const [category, weight] of Object.entries(variableWeights) as Array<
    [Exclude<ExpenseCategory, 'housing' | 'food'>, number]
  >) {
    suggested[category] = Math.max(0, Math.round(remaining * weight))
  }

  return suggested
}

function buildConfigFromDraft(
  draft: Required<Pick<FallbackDraft, 'event_title' | 'target_year' | 'target_amount' | 'monthly_savings_target' | 'priority'>>,
  setupContext: ChatSetupContext | null,
): ChatWizardConfig {
  const monthlyIncomeValue = setupContext?.monthly_income
  const currentSavingsValue = setupContext?.current_savings
  const monthlyIncome = monthlyIncomeValue !== undefined ? Math.max(0, Math.round(monthlyIncomeValue)) : 0
  const currentSavings = currentSavingsValue !== undefined ? Math.max(0, Math.round(currentSavingsValue)) : undefined

  return {
    monthly_income: monthlyIncome,
    monthly_savings_target: Math.max(0, Math.round(draft.monthly_savings_target)),
    ...(currentSavings === undefined ? {} : { current_savings: currentSavings }),
    life_goals: [
      {
        title: draft.event_title,
        target_amount: draft.target_amount,
        target_year: draft.target_year,
        priority: draft.priority,
      },
    ],
    suggested_budgets: buildSuggestedBudgets(
      setupContext,
      monthlyIncome,
      Math.max(0, Math.round(draft.monthly_savings_target)),
    ),
  }
}

function resolveFallbackTurn(state: FallbackState, input: string, setupContext: ChatSetupContext | null) {
  const trimmed = input.trim()
  const nextState: FallbackState = {
    step: state.step,
    draft: { ...state.draft },
  }

  switch (state.step) {
    case 0: {
      if (!trimmed) {
        return {
          nextState: state,
          assistantMessage: 'ライフイベントを読み取れませんでした。例: マイホーム / 結婚・育児 / FIRE / 留学',
          completedConfig: null,
        }
      }
      nextState.draft.event_title = trimmed.slice(0, 50)
      nextState.step = 1
      break
    }
    case 1: {
      const hasUnknown = parseUnknown(trimmed)
      const targetYearFromText = parseTargetYear(trimmed)
      const targetAmountFromText = parseAmount(trimmed, true)

      const targetYear = targetYearFromText ?? (hasUnknown ? 'unknown' : null)
      const targetAmount = targetAmountFromText ?? (hasUnknown ? 'unknown' : null)

      if (targetYear === null || targetAmount === null) {
        return {
          nextState: state,
          assistantMessage: '目標年と目標金額を読み取れませんでした。例: 2030年 500万円 / unknown',
          completedConfig: null,
        }
      }

      nextState.draft.target_year = targetYear
      nextState.draft.target_amount = targetAmount
      nextState.step = 2
      break
    }
    case 2: {
      const monthlySavingsTarget = parseAmount(trimmed, true)
      if (monthlySavingsTarget === null) {
        return {
          nextState: state,
          assistantMessage: '月々の貯蓄目標額を読み取れませんでした。例: 6万円',
          completedConfig: null,
        }
      }
      nextState.draft.monthly_savings_target = monthlySavingsTarget
      nextState.step = 3
      break
    }
    case 3: {
      const savingIntent = trimmed
      if (!savingIntent) {
        return {
          nextState: state,
          assistantMessage: '節約の意思を読み取れませんでした。例: 強め / 普通 / ゆるく',
          completedConfig: null,
        }
      }
      nextState.draft.saving_intent = savingIntent
      nextState.draft.priority = resolvePriorityFromIntent(savingIntent)

      const draft = nextState.draft
      const ready =
        draft.event_title !== undefined &&
        draft.target_year !== undefined &&
        draft.target_amount !== undefined &&
        draft.monthly_savings_target !== undefined &&
        draft.priority !== undefined

      if (!ready) {
        return {
          nextState: state,
          assistantMessage: '設定の作成に失敗しました。もう一度「やり直す」を押して進めてください。',
          completedConfig: null,
        }
      }

      return {
        nextState,
        assistantMessage: 'ヒアリングが完了しました。設定内容を確認して「保存する」を押してください。',
        completedConfig: buildConfigFromDraft(
          {
            event_title: draft.event_title!,
            target_year: draft.target_year!,
            target_amount: draft.target_amount!,
            monthly_savings_target: draft.monthly_savings_target!,
            priority: draft.priority!,
          },
          setupContext,
        ),
      }
    }
    default:
      return {
        nextState: state,
        assistantMessage: '入力を処理できませんでした。「やり直す」を押して最初から進めてください。',
        completedConfig: null,
      }
  }

  return {
    nextState,
    assistantMessage: FALLBACK_QUESTIONS[nextState.step] ?? '入力内容を確認して「保存する」を押してください。',
    completedConfig: null,
  }
}

function isPersistableGoal(goal: ChatWizardGoalConfig): goal is {
  title: string
  target_amount: number
  target_year: number
  priority: '高' | '中' | '低'
} {
  return (
    typeof goal.target_amount === 'number' &&
    Number.isFinite(goal.target_amount) &&
    typeof goal.target_year === 'number' &&
    Number.isFinite(goal.target_year) &&
    goal.priority !== 'unknown'
  )
}

export function useChatWizard() {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<ChatWizardConfig | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [mode, setMode] = useState<WizardMode>('ai')
  const [fallbackState, setFallbackState] = useState<FallbackState>(INITIAL_FALLBACK_STATE)
  const [shouldAutoClose, setShouldAutoClose] = useState(false)
  const [setupContext, setSetupContext] = useState<ChatSetupContext | null>(null)

  const canSend = useMemo(() => input.trim().length > 0 && !loading && !isComplete, [input, loading, isComplete])

  const send = useCallback(async () => {
    if (!canSend) {
      return
    }

    const trimmed = input.trim()
    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
    }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      if (mode === 'fallback') {
        const turn = resolveFallbackTurn(fallbackState, trimmed, setupContext)
        setFallbackState(turn.nextState)
        setMessages((prev) => [...prev, { role: 'model', content: turn.assistantMessage }])
        if (turn.completedConfig) {
          setIsComplete(true)
          setConfig(turn.completedConfig)
        }
        return
      }

      const response = await chatApi.send(nextMessages, setupContext)
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: response.content,
        },
      ])

      if (response.content.includes(FINISH_PHRASE)) {
        setShouldAutoClose(true)
      }

      if (response.is_complete && response.config) {
        setIsComplete(true)
        setConfig(response.config)
      }
    } catch (sendError) {
      const fallbackTurn = resolveFallbackTurn(fallbackState, trimmed, setupContext)
      setMode('fallback')
      setFallbackState(fallbackTurn.nextState)

      const prefix = 'AIの応答取得に失敗したため、ルールベースで続行します。'
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `${prefix}\n${fallbackTurn.assistantMessage}`,
        },
      ])

      if (fallbackTurn.completedConfig) {
        setIsComplete(true)
        setConfig(fallbackTurn.completedConfig)
      }

      setError(sendError instanceof Error ? sendError.message : 'チャットの送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [canSend, fallbackState, input, messages, mode, setupContext])

  const saveConfig = useCallback(async () => {
    if (!config || saving) {
      return { persisted: false }
    }

    setSaving(true)
    setError(null)

    let persisted = true

    const warnSkippedSave = (label: string, payload: unknown, saveError: unknown) => {
      persisted = false
      console.warn(`[chat-wizard] ${label} save skipped`, { payload, error: saveError })
    }

    try {
      const monthlyIncome = toNonNegativeInt(config.monthly_income)
      const profilePayload =
        monthlyIncome !== null && monthlyIncome > 0
          ? { monthly_income: monthlyIncome }
          : {}

      try {
        if (Object.keys(profilePayload).length > 0) {
          await authProfileApi.update(profilePayload)
        }
      } catch (updateError) {
        if (updateError instanceof ApiError && updateError.status === 404) {
          let displayName = 'ユーザー'
          try {
            const raw = localStorage.getItem('lifebalance:pending-profile')
            if (raw) {
              const pending = JSON.parse(raw) as { display_name?: string }
              if (pending.display_name) displayName = pending.display_name
              localStorage.removeItem('lifebalance:pending-profile')
            }
          } catch {}
          const createPayload = {
            display_name: displayName,
            ...(monthlyIncome !== null && monthlyIncome > 0 ? { monthly_income: monthlyIncome } : {}),
          }
          try {
            await authProfileApi.create(createPayload)
          } catch (createError) {
            warnSkippedSave('profile', createPayload, createError)
          }
        } else {
          warnSkippedSave('profile', profilePayload, updateError)
        }
      }

      const validGoals = config.life_goals.filter(isPersistableGoal)
      const monthlySavingPerGoal = validGoals.length > 0
        ? Math.max(0, Math.round(config.monthly_savings_target / validGoals.length))
        : 0
      const savedAmount = Math.max(0, Math.round(config.current_savings ?? 0))

      for (const goal of config.life_goals) {
        if (!isPersistableGoal(goal)) {
          warnSkippedSave('goal', goal, 'contains unknown fields')
          continue
        }

        const goalPayload = {
          title: goal.title,
          target_amount: goal.target_amount,
          saved_amount: savedAmount,
          monthly_saving: monthlySavingPerGoal,
          target_year: goal.target_year,
          priority: goal.priority,
        } as const

        try {
          await goalsApi.create(goalPayload)
        } catch (saveError) {
          warnSkippedSave('goal', goalPayload, saveError)
        }
      }

      const budgetEntries = Object.entries(config.suggested_budgets)
        .filter(
          (entry): entry is [ExpenseCategory, number] =>
            EXPENSE_CATEGORIES.includes(entry[0] as ExpenseCategory) && Number.isFinite(entry[1]),
        )
        .map(([category, limitAmount]) => ({
          category,
          limit_amount: Math.max(0, Math.round(limitAmount)),
          is_fixed: category === 'housing' || category === 'communication',
        }))

      if (budgetEntries.length > 0) {
        const budgetPayload = {
          year_month: getCurrentYearMonth(),
          budgets: budgetEntries,
        }
        try {
          await budgetsApi.updateBulk(budgetPayload)
          void queryClient.invalidateQueries({ queryKey: queryKeys.budgets(budgetPayload.year_month) })
        } catch (saveError) {
          warnSkippedSave('budget', budgetPayload, saveError)
        }
      }
    } finally {
      setSaving(false)
    }

    if (!persisted) {
      setError('一部の設定は保存をスキップしました。コンソールログを確認してください。')
    }

    return { persisted }
  }, [config, saving, queryClient])

  const reset = useCallback((nextSetupContext?: ChatSetupContext | null) => {
    setMessages(INITIAL_MESSAGES)
    setInput('')
    setLoading(false)
    setSaving(false)
    setError(null)
    setConfig(null)
    setIsComplete(false)
    setMode('ai')
    setFallbackState(INITIAL_FALLBACK_STATE)
    setShouldAutoClose(false)
    if (nextSetupContext !== undefined) {
      setSetupContext(normalizeSetupContext(nextSetupContext))
    }
  }, [])

  return {
    mode,
    messages,
    input,
    loading,
    saving,
    error,
    config,
    isComplete,
    canSend,
    shouldAutoClose,
    setupContext,
    setInput,
    send,
    saveConfig,
    reset,
  }
}

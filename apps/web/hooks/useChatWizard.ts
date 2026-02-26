'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ChatMessage, ChatWizardConfig } from '@lifebalance/shared/types'

import { ApiError, authProfileApi, budgetsApi, chatApi, goalsApi } from '@/lib/api'

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
  monthly_income?: number
  event_title?: string
  event_icon?: string
  target_year?: number
  target_amount?: number
  current_savings?: number
  rent_cost?: number
  communication_cost?: number
  monthly_savings_target?: number
}

type FallbackState = {
  step: number
  draft: FallbackDraft
}

const FALLBACK_QUESTIONS = [
  '月収（手取り）を選んでください。1) 〜20万 2) 20〜30万 3) 30〜40万 4) 40万〜（金額入力も可）',
  '最重要ライフイベントを選んでください。例: マイホーム / 結婚・育児 / FIRE / その他',
  '目標年と目標金額を教えてください。例: 2029年 500万円',
  '現在の貯蓄額を教えてください。例: 120万円',
  '主な固定費（家賃・通信費）を教えてください。例: 家賃 8万円、通信費 1万円',
  '月々の貯蓄目標額を教えてください。例: 6万円',
] as const

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'model',
    content: 'こんにちは。初期設定を進めます。まず、現在の月収（手取り）を教えてください。',
  },
]

const INITIAL_FALLBACK_STATE: FallbackState = {
  step: 0,
  draft: {},
}

function getCurrentYearMonth() {
  return new Date().toISOString().slice(0, 7)
}

function getCurrentYear() {
  return new Date().getUTCFullYear()
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

function parseIncomeInput(value: string) {
  const normalized = value.replace(/\s/g, '').toLowerCase()

  if (
    normalized === '1' ||
    normalized === '①' ||
    normalized.includes('〜20万') ||
    normalized.includes('~20万') ||
    normalized.includes('20万以下') ||
    normalized.includes('20万まで')
  ) {
    return 200000
  }

  if (
    normalized === '2' ||
    normalized === '②' ||
    normalized.includes('20〜30万') ||
    normalized.includes('20~30万') ||
    normalized.includes('20-30万')
  ) {
    return 250000
  }

  if (
    normalized === '3' ||
    normalized === '③' ||
    normalized.includes('30〜40万') ||
    normalized.includes('30~40万') ||
    normalized.includes('30-40万')
  ) {
    return 350000
  }

  if (
    normalized === '4' ||
    normalized === '④' ||
    normalized.includes('40万〜') ||
    normalized.includes('40万~') ||
    normalized.includes('40万以上')
  ) {
    return 450000
  }

  return parseAmount(value, true)
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

function extractEvent(input: string) {
  const normalized = input.toLowerCase()

  if (input.includes('マイホーム') || input.includes('住宅') || input.includes('家')) {
    return { title: 'マイホーム購入', icon: '🏠' }
  }
  if (input.includes('結婚') || input.includes('育児') || input.includes('子')) {
    return { title: '結婚・育児準備', icon: '👶' }
  }
  if (normalized.includes('fire')) {
    return { title: 'FIRE達成', icon: '🔥' }
  }
  if (input.includes('その他')) {
    return { title: 'その他ライフイベント', icon: '🌟' }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  return {
    title: trimmed.slice(0, 30),
    icon: '🌟',
  }
}

function buildSuggestedBudgets(draft: Required<Pick<FallbackDraft, 'monthly_income' | 'monthly_savings_target' | 'rent_cost' | 'communication_cost'>>) {
  const remaining = Math.max(
    0,
    draft.monthly_income - draft.monthly_savings_target - draft.rent_cost - draft.communication_cost,
  )

  const variableWeights: Record<Exclude<ExpenseCategory, 'housing' | 'communication'>, number> = {
    food: 0.32,
    transport: 0.12,
    entertainment: 0.16,
    clothing: 0.1,
    medical: 0.08,
    social: 0.12,
    other: 0.1,
  }

  const suggested: Record<ExpenseCategory, number> = {
    housing: Math.max(0, Math.round(draft.rent_cost)),
    communication: Math.max(0, Math.round(draft.communication_cost)),
    food: 0,
    transport: 0,
    entertainment: 0,
    clothing: 0,
    medical: 0,
    social: 0,
    other: 0,
  }

  for (const [category, weight] of Object.entries(variableWeights) as Array<[Exclude<ExpenseCategory, 'housing' | 'communication'>, number]>) {
    suggested[category] = Math.max(0, Math.round(remaining * weight))
  }

  return suggested
}

function buildConfigFromDraft(draft: Required<FallbackDraft>): ChatWizardConfig {
  const monthsToGoal = Math.max(1, (draft.target_year - getCurrentYear()) * 12)
  const remainingGoalAmount = Math.max(0, draft.target_amount - draft.current_savings)
  const requiredMonthlySaving = Math.ceil(remainingGoalAmount / monthsToGoal)
  const goalMonthlySaving = Math.max(requiredMonthlySaving, Math.round(draft.monthly_savings_target * 0.7))

  return {
    monthly_income: draft.monthly_income,
    monthly_savings_target: draft.monthly_savings_target,
    life_goals: [
      {
        title: draft.event_title,
        icon: draft.event_icon,
        target_amount: draft.target_amount,
        monthly_saving: goalMonthlySaving,
        target_year: draft.target_year,
        priority: '高',
      },
    ],
    suggested_budgets: buildSuggestedBudgets({
      monthly_income: draft.monthly_income,
      monthly_savings_target: draft.monthly_savings_target,
      rent_cost: draft.rent_cost,
      communication_cost: draft.communication_cost,
    }),
  }
}

function resolveFallbackTurn(state: FallbackState, input: string) {
  const trimmed = input.trim()
  const nextState: FallbackState = {
    step: state.step,
    draft: { ...state.draft },
  }

  switch (state.step) {
    case 0: {
      const monthlyIncome = parseIncomeInput(trimmed)
      if (!monthlyIncome) {
        return {
          nextState: state,
          assistantMessage: '月収を読み取れませんでした。1〜4の選択肢、または金額（例: 28万円）で入力してください。',
          completedConfig: null,
        }
      }
      nextState.draft.monthly_income = monthlyIncome
      nextState.step = 1
      break
    }
    case 1: {
      const event = extractEvent(trimmed)
      if (!event) {
        return {
          nextState: state,
          assistantMessage: 'ライフイベントを読み取れませんでした。例: マイホーム / 結婚・育児 / FIRE / その他',
          completedConfig: null,
        }
      }
      nextState.draft.event_title = event.title
      nextState.draft.event_icon = event.icon
      nextState.step = 2
      break
    }
    case 2: {
      const targetYear = parseTargetYear(trimmed)
      const amountSource = targetYear ? trimmed.replace(String(targetYear), '') : trimmed
      const targetAmount = parseAmount(amountSource, true)

      if (!targetYear || !targetAmount) {
        return {
          nextState: state,
          assistantMessage: '目標年と目標金額を読み取れませんでした。例: 2029年 500万円',
          completedConfig: null,
        }
      }

      nextState.draft.target_year = targetYear
      nextState.draft.target_amount = targetAmount
      nextState.step = 3
      break
    }
    case 3: {
      const currentSavings = parseAmount(trimmed, true)
      if (currentSavings === null) {
        return {
          nextState: state,
          assistantMessage: '現在の貯蓄額を読み取れませんでした。例: 120万円',
          completedConfig: null,
        }
      }
      nextState.draft.current_savings = currentSavings
      nextState.step = 4
      break
    }
    case 4: {
      const values = trimmed.match(/[0-9][0-9,]*(?:\.[0-9]+)?\s*万?|[0-9][0-9,]*/g) ?? []
      const first = values[0] ? parseAmount(values[0], true) : null
      const second = values[1] ? parseAmount(values[1], true) : null

      if (first === null || second === null) {
        return {
          nextState: state,
          assistantMessage: '固定費は2つ必要です。例: 家賃 8万円、通信費 1万円',
          completedConfig: null,
        }
      }

      nextState.draft.rent_cost = first
      nextState.draft.communication_cost = second
      nextState.step = 5
      break
    }
    case 5: {
      const monthlySavingsTarget = parseAmount(trimmed, true)
      if (monthlySavingsTarget === null) {
        return {
          nextState: state,
          assistantMessage: '月々の貯蓄目標額を読み取れませんでした。例: 6万円',
          completedConfig: null,
        }
      }
      nextState.draft.monthly_savings_target = monthlySavingsTarget

      const draft = nextState.draft
      const ready =
        draft.monthly_income !== undefined &&
        draft.event_title !== undefined &&
        draft.event_icon !== undefined &&
        draft.target_year !== undefined &&
        draft.target_amount !== undefined &&
        draft.current_savings !== undefined &&
        draft.rent_cost !== undefined &&
        draft.communication_cost !== undefined &&
        draft.monthly_savings_target !== undefined

      if (!ready) {
        return {
          nextState: state,
          assistantMessage: '設定の作成に失敗しました。もう一度「やり直す」を押して進めてください。',
          completedConfig: null,
        }
      }

      return {
        nextState: nextState,
        assistantMessage: 'ヒアリングが完了しました。設定内容を確認して「保存する」を押してください。',
        completedConfig: buildConfigFromDraft(draft as Required<FallbackDraft>),
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

const FINISH_PHRASE = 'これで記録を終了します'

export function useChatWizard() {
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
        const turn = resolveFallbackTurn(fallbackState, trimmed)
        setFallbackState(turn.nextState)
        setMessages((prev) => [...prev, { role: 'model', content: turn.assistantMessage }])
        if (turn.completedConfig) {
          setIsComplete(true)
          setConfig(turn.completedConfig)
        }
        return
      }

      const response = await chatApi.send(nextMessages)
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
      const fallbackTurn = resolveFallbackTurn(fallbackState, trimmed)
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
  }, [canSend, fallbackState, input, messages, mode])

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
      const profilePayload = {
        monthly_income: config.monthly_income,
      }
      try {
        await authProfileApi.update(profilePayload)
      } catch (updateError) {
        // プロフィールが存在しない場合（メール確認後の初回ログインなど）は新規作成にフォールバック
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
          const createPayload = { display_name: displayName, monthly_income: config.monthly_income }
          try {
            await authProfileApi.create(createPayload)
          } catch (createError) {
            warnSkippedSave('profile', createPayload, createError)
          }
        } else {
          warnSkippedSave('profile', profilePayload, updateError)
        }
      }

      for (const goal of config.life_goals) {
        const goalPayload = {
          title: goal.title,
          icon: goal.icon,
          target_amount: goal.target_amount,
          monthly_saving: goal.monthly_saving,
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
        } catch (saveError) {
          warnSkippedSave('budget', budgetPayload, saveError)
        }
      }
    } finally {
      setSaving(false)
    }

    if (!persisted) {
      setError('一部の設定はAPI未接続のため保存をスキップしました。コンソールログを確認してください。')
    }

    return { persisted }
  }, [config, saving])

  const reset = useCallback(() => {
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
    setInput,
    send,
    saveConfig,
    reset,
  }
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatSetupContext } from '@lifebalance/shared/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChatWizard } from '@/hooks/useChatWizard'
import { useToast } from '@/hooks/useToast'
import { ApiError, assumptionsApi, authProfileApi } from '@/lib/api'
import { getSupabaseBrowserClient } from '@/lib/supabase'

function AiAvatar() {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-lg">
        🤖
      </div>
    )
  }

  return (
    <img
      src="/ai-avatar.svg"
      alt="AIアシスタント"
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
      onError={() => setImgError(true)}
    />
  )
}

type Step = 'checking' | 'questions' | 'wizard'
type SetupField = 'display_name' | 'age' | 'monthly_income' | 'housing_cost' | 'daily_food_cost' | 'current_savings'

type SetupAnswers = {
  display_name: string
  age?: number
  monthly_income?: number
  housing_cost?: number
  daily_food_cost?: number
  current_savings?: number
}

type SetupQuestion = {
  key: SetupField
  title: string
  description: string
  placeholder: string
  required: boolean
  inputMode: 'text' | 'numeric'
}

const SETUP_QUESTIONS: SetupQuestion[] = [
  {
    key: 'display_name',
    title: '表示名',
    description: 'アプリ内で使う表示名を入力してください。',
    placeholder: '例: 田中 太郎',
    required: true,
    inputMode: 'text',
  },
  {
    key: 'age',
    title: '年齢',
    description: 'あなたの現在の年齢を入力してください。（任意）',
    placeholder: '例: 30',
    required: false,
    inputMode: 'numeric',
  },
  {
    key: 'monthly_income',
    title: '月収（手取り額）',
    description: 'あなたの現在の月収（手取り額）を入力してください。（任意）',
    placeholder: '例: 140,000',
    required: false,
    inputMode: 'numeric',
  },
  {
    key: 'housing_cost',
    title: '月々の住居費（家賃・水道光熱費含む）',
    description: 'あなたが現在支払っている家賃や水道光熱費を含めた住居費を入力してください。（任意）',
    placeholder: '例: 80,000',
    required: false,
    inputMode: 'numeric',
  },
  {
    key: 'daily_food_cost',
    title: '1日の平均的な食費',
    description: 'あなたが現在支払っている1日の平均的な食費を入力してください。（任意）',
    placeholder: '例: 1,500',
    required: false,
    inputMode: 'numeric',
  },
  {
    key: 'current_savings',
    title: '現在の貯蓄額',
    description: 'あなたの現在のおおまかな貯蓄額を入力してください。（任意）',
    placeholder: '例: 120,000',
    required: false,
    inputMode: 'numeric',
  },
]

function formatDigitsWithCommas(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const normalized = digits.replace(/^0+(?=\d)/, '')
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function toDigitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function formatAnswerValue(key: SetupField, answers: SetupAnswers) {
  const value = answers[key]
  if (value === undefined) return ''
  if (key === 'display_name') return typeof value === 'string' ? value : ''
  if (typeof value !== 'number') return ''
  if (key === 'age') return String(value)
  return formatDigitsWithCommas(String(value))
}

function buildSetupContext(answers: SetupAnswers): ChatSetupContext {
  return {
    ...(answers.monthly_income === undefined ? {} : { monthly_income: answers.monthly_income }),
    ...(answers.current_savings === undefined ? {} : { current_savings: answers.current_savings }),
    ...(answers.housing_cost === undefined ? {} : { housing_cost: answers.housing_cost }),
    ...(answers.daily_food_cost === undefined ? {} : { daily_food_cost: answers.daily_food_cost }),
  }
}

export default function SetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const wizard = useChatWizard()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('checking')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<SetupAnswers>({ display_name: '' })
  const [inputValue, setInputValue] = useState('')
  const [questionError, setQuestionError] = useState('')
  const [savingSetup, setSavingSetup] = useState(false)

  const currentQuestion = SETUP_QUESTIONS[questionIndex]
  const isLastQuestion = questionIndex === SETUP_QUESTIONS.length - 1

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/login')
        return
      }

      try {
        const profile = await authProfileApi.get()
        if (profile.display_name !== '') {
          router.replace('/dashboard')
          return
        }
      } catch (error) {
        if (error instanceof ApiError && error.status !== 404) {
          router.replace('/dashboard')
          return
        }
      }

      setStep('questions')
      setQuestionIndex(0)
      setInputValue('')
    })
  }, [router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [wizard.messages, wizard.loading])

  useEffect(() => {
    if (!wizard.shouldAutoClose) return

    void (async () => {
      try {
        const result = await wizard.saveConfig()
        toast({
          title: result.persisted ? '設定を保存しました' : '設定内容を確認用として保持しました',
          variant: result.persisted ? 'success' : 'default',
        })
      } catch {
        toast({ title: '設定保存に失敗しました', variant: 'error' })
      } finally {
        router.push('/dashboard')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.shouldAutoClose])

  const canSave = useMemo(
    () => wizard.isComplete && wizard.config && !wizard.saving,
    [wizard.config, wizard.isComplete, wizard.saving],
  )

  function handleQuestionInputChange(raw: string) {
    if (!currentQuestion || currentQuestion.inputMode !== 'numeric') {
      setInputValue(raw)
      setQuestionError('')
      return
    }

    const digitsOnly = toDigitsOnly(raw)

    if (currentQuestion.key === 'age') {
      setInputValue(digitsOnly)
      setQuestionError('')
      return
    }

    setInputValue(formatDigitsWithCommas(digitsOnly))
    setQuestionError('')
  }

  function parseQuestionInput(question: SetupQuestion, raw: string) {
    const trimmed = raw.trim()
    if (question.key === 'display_name') {
      if (!trimmed) {
        return { ok: false, error: '表示名は必須です。' as const }
      }
      if (trimmed.length > 50) {
        return { ok: false, error: '表示名は50文字以内で入力してください。' as const }
      }
      return { ok: true, value: trimmed }
    }

    if (!trimmed) {
      return { ok: true, value: undefined }
    }

    if (question.key === 'age') {
      if (!/^\d+$/.test(trimmed)) {
        return { ok: false, error: '年齢は数字のみで入力してください。' as const }
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 18 || parsed > 100) {
        return { ok: false, error: '年齢は18〜100の範囲で入力してください。' as const }
      }
      return { ok: true, value: Math.round(parsed) }
    }

    const normalizedAmount = trimmed.replace(/,/g, '')
    if (!/^\d+$/.test(normalizedAmount)) {
      return { ok: false, error: '金額は数字のみで入力してください。' as const }
    }

    const amount = Number(normalizedAmount)
    if (!Number.isFinite(amount)) {
      return { ok: false, error: '金額が正しくありません。' as const }
    }
    return { ok: true, value: Math.max(0, Math.round(amount)) }
  }

  async function persistSetupData(nextAnswers: SetupAnswers) {
    const profilePayload = {
      display_name: nextAnswers.display_name,
      ...(nextAnswers.monthly_income === undefined ? {} : { monthly_income: nextAnswers.monthly_income }),
    }

    try {
      await authProfileApi.update(profilePayload)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error
      }

      await authProfileApi.create({
        display_name: nextAnswers.display_name,
        ...(nextAnswers.monthly_income === undefined ? {} : { monthly_income: nextAnswers.monthly_income }),
      })
    }

    if (nextAnswers.age !== undefined) {
      const assumptions = await assumptionsApi.get()
      await assumptionsApi.update({
        age: nextAnswers.age,
        annual_income_growth: assumptions.annual_income_growth,
        investment_return: assumptions.investment_return,
        inflation_rate: assumptions.inflation_rate,
        monthly_investment: assumptions.monthly_investment,
        simulation_trials: assumptions.simulation_trials,
      })
    }
  }

  function goToQuestion(nextIndex: number, nextAnswers: SetupAnswers) {
    const question = SETUP_QUESTIONS[nextIndex]
    setQuestionIndex(nextIndex)
    setInputValue(formatAnswerValue(question.key, nextAnswers))
    setQuestionError('')
  }

  async function completeQuestions(nextAnswers: SetupAnswers) {
    setSavingSetup(true)
    setQuestionError('')
    try {
      await persistSetupData(nextAnswers)
      wizard.reset(buildSetupContext(nextAnswers))
      setStep('wizard')
    } catch {
      setQuestionError('初期情報の保存に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setSavingSetup(false)
    }
  }

  async function handleQuestionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentQuestion) return

    const parsed = parseQuestionInput(currentQuestion, inputValue)
    if (!parsed.ok) {
      setQuestionError(parsed.error ?? '')
      return
    }

    const nextAnswers: SetupAnswers = {
      ...answers,
      [currentQuestion.key]: parsed.value,
    }
    setAnswers(nextAnswers)

    if (isLastQuestion) {
      await completeQuestions(nextAnswers)
      return
    }

    goToQuestion(questionIndex + 1, nextAnswers)
  }

  async function handleSkip() {
    if (!currentQuestion || currentQuestion.required) return

    const nextAnswers: SetupAnswers = {
      ...answers,
      [currentQuestion.key]: undefined,
    }
    setAnswers(nextAnswers)

    if (isLastQuestion) {
      await completeQuestions(nextAnswers)
      return
    }

    goToQuestion(questionIndex + 1, nextAnswers)
  }

  function handleBack() {
    if (questionIndex === 0) return
    goToQuestion(questionIndex - 1, answers)
  }

  if (step === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text2">読み込み中...</p>
      </div>
    )
  }

  if (step === 'questions' && currentQuestion) {
    const heading = questionIndex >= 1 && answers.display_name.trim()
      ? `はじめまして、${answers.display_name}さん`
      : 'はじめまして'

    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_10px_28px_rgba(35,55,95,0.06)]">
          <h1 className="font-display text-2xl font-bold">{heading}</h1>
          <p className="mt-1 text-sm text-text2">
            {questionIndex + 1}/{SETUP_QUESTIONS.length}: {currentQuestion.description}
          </p>

          <form onSubmit={(event) => void handleQuestionSubmit(event)} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-text2" htmlFor={currentQuestion.key}>
                {currentQuestion.title}
              </label>
              <Input
                id={currentQuestion.key}
                value={inputValue}
                onChange={(event) => handleQuestionInputChange(event.target.value)}
                placeholder={currentQuestion.placeholder}
                required={currentQuestion.required}
                inputMode={currentQuestion.inputMode}
              />
            </div>

            {questionError ? <p className="text-sm text-danger">{questionError}</p> : null}

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={questionIndex === 0 || savingSetup}
              >
                一つ戻る
              </Button>

              <div className="flex items-center gap-2">
                {!currentQuestion.required ? (
                  <Button type="button" variant="ghost" onClick={() => void handleSkip()} disabled={savingSetup}>
                    スキップ
                  </Button>
                ) : null}
                <Button type="submit" disabled={savingSetup}>
                  {savingSetup ? '保存中...' : isLastQuestion ? '初期設定チャットへ進む' : '次へ'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">初期設定</h1>
          <p className="mt-1 text-sm text-text2">AIとの会話で目標・貯蓄目標・節約の意思を設定します。</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_28px_rgba(35,55,95,0.06)]">
          {wizard.mode === 'fallback' ? (
            <p className="mb-3 rounded-md border border-warn/40 bg-warn/25 px-3 py-2 text-xs text-[var(--warn-text)]">
              AI応答の代わりにルールベースで進行中です。
            </p>
          ) : null}

          <div
            className="max-h-[400px] space-y-4 overflow-y-auto rounded-xl border border-border bg-card2 p-3"
            aria-live="polite"
          >
            {wizard.messages.map((message, index) =>
              message.role === 'model' ? (
                <div key={`${message.role}-${index}`} className="flex items-start gap-2">
                  <AiAvatar />
                  <div className="max-w-[85%] rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-text">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={`${message.role}-${index}`} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-tr-none border border-border bg-card px-3 py-2 text-sm text-text">
                    {message.content}
                  </div>
                </div>
              ),
            )}
            {wizard.loading ? (
              <div className="flex items-start gap-2">
                <AiAvatar />
                <div className="max-w-[85%] rounded-lg rounded-tl-none border border-accent/20 bg-accent/10 px-3 py-2">
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

          {wizard.error ? <p className="mt-3 text-xs text-danger">{wizard.error}</p> : null}

          {wizard.isComplete && wizard.config ? (
            <div className="mt-4 space-y-2 rounded-xl border border-accent/30 bg-accent/10 p-3">
              <p className="text-sm font-semibold">設定プレビュー</p>
              <pre className="overflow-x-auto text-xs text-text2">{JSON.stringify(wizard.config, null, 2)}</pre>
            </div>
          ) : (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void wizard.send()
              }}
            >
              <Input
                value={wizard.input}
                onChange={(event) => wizard.setInput(event.target.value)}
                placeholder="回答を入力してください"
                disabled={wizard.loading}
                aria-label="チャット入力"
              />
              <Button type="submit" disabled={!wizard.canSend}>
                送信
              </Button>
            </form>
          )}

          <div className="mt-4 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => wizard.reset(wizard.setupContext)}>
              やり直す
            </Button>
            <Button
              type="button"
              disabled={!canSave}
              onClick={async () => {
                try {
                  const result = await wizard.saveConfig()
                  toast({
                    title: result.persisted ? '設定を保存しました' : '設定内容を確認用として保持しました',
                    variant: result.persisted ? 'success' : 'default',
                  })
                  router.push('/dashboard')
                } catch {
                  toast({ title: '設定保存に失敗しました', variant: 'error' })
                }
              }}
            >
              {wizard.saving ? '保存中...' : '保存する'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

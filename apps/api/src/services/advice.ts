import { z } from 'zod'
import type { AdviceContent, BudgetSummary, LifeGoal } from '@lifebalance/shared/types'

import { getAssumptionsByUserId } from '../db/repositories/assumptions'
import { getAdviceByMonth, listAdviceHistory, upsertAdviceLog } from '../db/repositories/advice'
import { listBudgetsByMonth } from '../db/repositories/budgets'
import { listGoals } from '../db/repositories/goals'
import { getTransactionSummary, listRecentMonthlyExpenseTotals } from '../db/repositories/transactions'
import { getUserById } from '../db/repositories/users'
import { getCurrentYearMonth } from '../lib/date'
import { AppError } from '../lib/errors'
import { extractFirstJsonObject, generateGeminiText } from './gemini'
import { ADVICE_SYSTEM_PROMPT, buildAdviceUserContext } from './prompts/advice'

const adviceModelResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  urgent: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).max(2),
  suggestions: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1).max(3),
  positives: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1).max(2),
  next_month_goals: z.array(z.string().min(1)).min(1).max(4),
})

const FALLBACK_ADVICE_CONTENT: AdviceContent = {
  urgent: [],
  suggestions: [
    {
      title: 'まずは固定費を確認しましょう',
      body: '通信費やサブスクを見直すと、無理なく毎月の余剰資金を作れます。',
    },
    {
      title: '食費の上限を先に決める',
      body: '週ごとの予算を決めると、月末の使いすぎを防げます。',
    },
  ],
  positives: [
    {
      title: '記録を継続できています',
      body: '家計改善は継続が最重要です。今の習慣は大きな強みです。',
    },
  ],
  next_month_goals: ['週次で支出を振り返る', '固定費を1つ見直す'],
}

export type GenerateAdviceParams = {
  userId: string
  month: string
  force: boolean
}

export type GeneratedAdviceResult = {
  id: string
  month: string
  score: number
  content: AdviceContent
  generated_at: string
}

function toGeneratedAdviceResult(row: {
  id: string
  month: string
  score: number
  content: unknown
  generatedAt: Date
}): GeneratedAdviceResult {
  return {
    id: row.id,
    month: row.month,
    score: row.score,
    content: row.content as AdviceContent,
    generated_at: row.generatedAt.toISOString(),
  }
}

function getPreviousMonth(yearMonth: string) {
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return getCurrentYearMonth()
  }

  const previous = new Date(Date.UTC(year, month - 2, 1))
  return previous.toISOString().slice(0, 7)
}

function buildBudgetSummary(params: {
  yearMonth: string
  rows: Array<{
    id: string
    category: string
    limitAmount: number
    isFixed: boolean
    createdAt: Date
    updatedAt: Date
  }>
  spentByCategory: Map<string, { amount: number }>
  totalSpent: number
}): BudgetSummary {
  const budgets = params.rows.map((row) => {
    const spentAmount = params.spentByCategory.get(row.category)?.amount ?? 0
    const usageRate = row.limitAmount === 0 ? 0 : Number((spentAmount / row.limitAmount).toFixed(4))

    return {
      id: row.id,
      category: row.category as BudgetSummary['budgets'][number]['category'],
      limit_amount: row.limitAmount,
      is_fixed: row.isFixed,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      spent_amount: spentAmount,
      usage_rate: usageRate,
    }
  })

  return {
    year_month: params.yearMonth,
    budgets,
    total_budget: params.rows.reduce((sum, row) => sum + row.limitAmount, 0),
    total_spent: params.totalSpent,
  }
}

/**
 * Parses unstable model output and always returns a safe advice object.
 */
function parseAdviceModelOutput(rawText: string): { score: number; content: AdviceContent } {
  try {
    const jsonText = extractFirstJsonObject(rawText)
    if (!jsonText) {
      return {
        score: 60,
        content: FALLBACK_ADVICE_CONTENT,
      }
    }

    const parsed = adviceModelResponseSchema.safeParse(JSON.parse(jsonText))
    if (!parsed.success) {
      return {
        score: 60,
        content: FALLBACK_ADVICE_CONTENT,
      }
    }

    return {
      score: parsed.data.score,
      content: {
        urgent: parsed.data.urgent,
        suggestions: parsed.data.suggestions,
        positives: parsed.data.positives,
        next_month_goals: parsed.data.next_month_goals,
      },
    }
  } catch {
    return {
      score: 60,
      content: FALLBACK_ADVICE_CONTENT,
    }
  }
}

export async function findAdviceCache(userId: string, month?: string) {
  const targetMonth = month ?? getCurrentYearMonth()
  const advice = await getAdviceByMonth(userId, targetMonth)

  if (!advice) {
    return null
  }

  return toGeneratedAdviceResult(advice)
}

const QUESTION_SYSTEM_PROMPT = `
あなたは日本人向けの家計管理・資産形成の専門AIアドバイザーです。
ユーザーの質問に対して、具体的で実用的な回答を提供してください。

## 回答の原則
- 上から目線にならず、親しみやすいトーンで回答する
- 金額は具体的に記載する
- 専門用語は使わず、わかりやすく説明する
- 回答は300文字以内で簡潔にまとめる
`.trim()

export async function answerAdviceQuestion(question: string): Promise<string> {
  try {
    const answer = await generateGeminiText({
      systemInstruction: QUESTION_SYSTEM_PROMPT,
      prompt: question,
    })
    return answer.trim()
  } catch {
    return '申し訳ありません。回答の生成に失敗しました。しばらくしてから再度お試しください。'
  }
}

export async function getAdviceHistory(userId: string, months: number) {
  const rows = await listAdviceHistory(userId, months)

  return rows.map((row) => ({
    month: row.month,
    score: row.score,
  }))
}

export async function generateAdvice(params: GenerateAdviceParams): Promise<GeneratedAdviceResult> {
  if (!params.force) {
    const cached = await findAdviceCache(params.userId, params.month)
    if (cached) {
      return cached
    }
  }

  const previousMonth = getPreviousMonth(params.month)

  const [profile, assumptions, budgetRows, transactionSummary, monthlyTotals, goals, previousAdvice] =
    await Promise.all([
      getUserById(params.userId),
      getAssumptionsByUserId(params.userId),
      listBudgetsByMonth(params.userId, params.month),
      getTransactionSummary(params.userId, params.month),
      listRecentMonthlyExpenseTotals(params.userId, 3),
      listGoals(params.userId),
      getAdviceByMonth(params.userId, previousMonth),
    ])

  if (!profile) {
    throw new AppError('NOT_FOUND', 'Profile not found')
  }

  const spentByCategory = new Map(
    transactionSummary.byCategory.map((row) => [row.category, { amount: row.amount }]),
  )

  const budgetSummary = buildBudgetSummary({
    yearMonth: params.month,
    rows: budgetRows,
    spentByCategory,
    totalSpent: transactionSummary.totalExpense,
  })

  const monthlyExpenseTotals = monthlyTotals.map((row) => ({
    year_month: row.yearMonth,
    total_expense: row.totalExpense,
  }))

  const lifeGoals: LifeGoal[] = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    icon: goal.icon,
    target_amount: goal.targetAmount,
    saved_amount: goal.savedAmount,
    monthly_saving: goal.monthlySaving,
    target_year: goal.targetYear,
    priority: goal.priority as LifeGoal['priority'],
    status: goal.status as LifeGoal['status'],
    sort_order: goal.sortOrder,
    progress_rate:
      goal.targetAmount === 0 ? 0 : Number((goal.savedAmount / goal.targetAmount).toFixed(4)),
    created_at: goal.createdAt.toISOString(),
    updated_at: goal.updatedAt.toISOString(),
  }))

  const userContext = buildAdviceUserContext({
    month: params.month,
    profile: {
      id: profile.id,
      display_name: profile.displayName,
      monthly_income: profile.monthlyIncome,
      created_at: profile.createdAt.toISOString(),
      updated_at: profile.updatedAt.toISOString(),
    },
    budgetSummary,
    monthlyExpenseTotals,
    goals: lifeGoals,
    previousAdvice: (previousAdvice?.content as AdviceContent | undefined) ?? null,
    age: assumptions?.age ?? 30,
  })

  let generated = {
    score: 60,
    content: FALLBACK_ADVICE_CONTENT,
  }

  try {
    const responseText = await generateGeminiText({
      systemInstruction: ADVICE_SYSTEM_PROMPT,
      prompt: userContext,
    })
    generated = parseAdviceModelOutput(responseText)
  } catch {
    generated = {
      score: 60,
      content: FALLBACK_ADVICE_CONTENT,
    }
  }

  const [saved] = await upsertAdviceLog(params.userId, {
    month: params.month,
    score: generated.score,
    content: generated.content,
  })

  if (!saved) {
    throw new AppError('INTERNAL_ERROR', 'Failed to save advice')
  }

  return toGeneratedAdviceResult(saved)
}

/**
 * LINE / Discord 共通のボットロジック
 * プラットフォーム固有のコード（署名検証・返信API）はそれぞれのサービスに実装する
 */
import { z } from 'zod'

import { listBudgetsByMonth } from '../db/repositories/budgets'
import { createTransaction, getTransactionSummary } from '../db/repositories/transactions'
import { getCurrentYearMonth } from '../lib/date'
import { EXPENSE_CATEGORIES } from '../schemas/constants'
import { extractFirstJsonObject, generateGeminiText } from './gemini'

// ─────────────────────────────────────────────
// 定数・ユーティリティ
// ─────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  housing: '住居費',
  food: '食費',
  transport: '交通費',
  entertainment: '娯楽・趣味',
  clothing: '衣類・日用品',
  communication: '通信費',
  medical: '医療・健康',
  social: '交際費',
  other: 'その他',
}

export const BOT_HELP_MESSAGE = `使い方:
- 例: 「ランチ 850円」「交通費1200円」
- 画像送信: レシート画像を送ると自動登録します
- コマンド: 「サマリー」「help」`

export function formatCurrency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

export function normalizeDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return /^\d{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10)
}

export function buildUsageBar(percentage: number | null) {
  if (percentage === null) return ''
  const clamped = Math.max(0, Math.min(100, percentage))
  const filled = Math.round((clamped / 100) * 8)
  return `${'█'.repeat(filled)}${'░'.repeat(8 - filled)}`
}

// ─────────────────────────────────────────────
// AI テキスト解析
// ─────────────────────────────────────────────

const EXPENSE_EXTRACTION_PROMPT = `
あなたは家計管理アプリの入力正規化AIです。
ユーザーの自然言語メッセージから支出情報を抽出し、JSONのみで返してください。

{
  "amount": 数値,
  "category": "housing | food | transport | entertainment | clothing | communication | medical | social | other",
  "description": "要約（20文字以内）",
  "transacted_at": "YYYY-MM-DD"
}

不明な場合は null を入れてください。説明文は不要です。
`.trim()

export const expenseExtractionSchema = z.object({
  amount: z.number().int().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().nullable().optional(),
  transacted_at: z.string().nullable().optional(),
})

export async function parseExpenseText(text: string) {
  try {
    const responseText = await generateGeminiText({
      prompt: `${EXPENSE_EXTRACTION_PROMPT}\n\n入力: ${text}`,
    })

    const jsonText = extractFirstJsonObject(responseText)
    if (!jsonText) return null

    const parsed = expenseExtractionSchema.safeParse(JSON.parse(jsonText))
    if (!parsed.success) return null

    return {
      amount: parsed.data.amount,
      category: parsed.data.category,
      description: parsed.data.description ?? text.slice(0, 20),
      transacted_at: normalizeDate(parsed.data.transacted_at),
    }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// カテゴリ使用状況
// ─────────────────────────────────────────────

export async function formatCategoryMonthlyUsage(userId: string, category: string, yearMonth: string) {
  const [summary, budgets] = await Promise.all([
    getTransactionSummary(userId, yearMonth),
    listBudgetsByMonth(userId, yearMonth),
  ])

  const categorySpending = summary.byCategory.find((item) => item.category === category)?.amount ?? 0
  const limit = budgets.find((item) => item.category === category)?.limitAmount
  const usage = typeof limit === 'number' && limit > 0 ? (categorySpending / limit) * 100 : null
  const label = CATEGORY_LABELS[category] ?? category

  if (usage === null || typeof limit !== 'number') {
    return `今月の${label}: ${formatCurrency(categorySpending)}`
  }

  return `今月の${label}: ${formatCurrency(categorySpending)} / ${formatCurrency(limit)}（${usage.toFixed(1)}%）`
}

// ─────────────────────────────────────────────
// 月次サマリーテキスト生成
// ─────────────────────────────────────────────

export async function buildSummaryMessageText(userId: string, targetYearMonth?: string): Promise<string> {
  const yearMonth = targetYearMonth ?? getCurrentYearMonth()
  const [summary, budgets] = await Promise.all([
    getTransactionSummary(userId, yearMonth),
    listBudgetsByMonth(userId, yearMonth),
  ])

  const [year, month] = yearMonth.split('-')
  const categoryLines = summary.byCategory.slice(0, 5).map((row) => {
    const limit = budgets.find((item) => item.category === row.category)?.limitAmount
    const percent = typeof limit === 'number' && limit > 0 ? Math.round((row.amount / limit) * 100) : null
    const label = CATEGORY_LABELS[row.category] ?? row.category
    const bar = buildUsageBar(percent)
    const percentText = percent === null ? '-' : `${percent}%`
    return `${label.padEnd(6, ' ')} ${formatCurrency(row.amount)} ${bar} ${percentText}`
  })

  return [
    `📊 ${year}年${Number(month)}月のサマリー`,
    '',
    `💰 支出合計: ${formatCurrency(summary.totalExpense)}`,
    `💚 貯蓄:    ${formatCurrency(summary.totalIncome - summary.totalExpense)}`,
    '',
    '【カテゴリ別】',
    categoryLines.length > 0 ? categoryLines.join('\n') : '- データなし',
    '',
    '詳細はこちら👇',
    'https://lifebalance.app/dashboard',
  ].join('\n')
}

// ─────────────────────────────────────────────
// 支出登録（プラットフォーム共通）
// ─────────────────────────────────────────────

export async function createBotExpense(params: {
  userId: string
  amount: number
  category: string
  description: string | null
  transactedAt: string
  source: 'line' | 'discord'
}) {
  await createTransaction(params.userId, {
    amount: params.amount,
    type: 'expense',
    category: params.category,
    description: params.description,
    receiptUrl: null,
    source: params.source,
    transactedAt: params.transactedAt,
  })
}

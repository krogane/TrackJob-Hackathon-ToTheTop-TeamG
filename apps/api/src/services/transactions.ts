import {
  createTransaction,
  deleteTransactionById,
  getDailyVariableTrend,
  getMonthlyFixedExpenseTotals,
  getMonthlyTrend,
  getRecordingStreak,
  getSpentAmountsByCategory,
  getTransactionById,
  getTransactionSummary,
  getTotalSpent,
  getWeeklyVariableTrend,
  listTransactions,
  updateTransactionById,
} from '../db/repositories/transactions'
import { AppError } from '../lib/errors'
import { getCurrentYearMonth } from '../lib/date'
import { supabaseAdmin } from '../clients/supabase'
import { ensureBucketExists } from '../lib/storage'
import { toIsoString } from './serializers'

function mapTransaction(row: {
  id: string
  amount: number
  type: string
  category: string
  description: string | null
  receiptUrl: string | null
  source: string
  transactedAt: string
  createdAt: Date
}) {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type,
    category: row.category,
    description: row.description,
    receipt_url: row.receiptUrl,
    source: row.source,
    transacted_at: row.transactedAt,
    created_at: toIsoString(row.createdAt),
  }
}

function assertOwner(resourceUserId: string, userId: string) {
  if (resourceUserId !== userId) {
    throw new AppError('FORBIDDEN', 'Access to this resource is forbidden')
  }
}

export async function listUserTransactions(
  userId: string,
  query: {
    year_month?: string | 'all'
    category?: string
    type?: 'expense' | 'income'
    source?: 'dashboard' | 'line' | 'discord'
    keyword?: string
    page: number
    limit: number
    sort: 'transacted_at' | 'amount' | 'created_at'
    order: 'asc' | 'desc'
  },
) {
  const yearMonth = query.year_month === 'all' ? undefined : (query.year_month ?? getCurrentYearMonth())

  const { rows, total } = await listTransactions(userId, {
    yearMonth,
    category: query.category,
    type: query.type,
    source: query.source,
    keyword: query.keyword,
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    order: query.order,
  })

  return {
    data: rows.map(mapTransaction),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      has_next: query.page * query.limit < total,
    },
  }
}

export async function createUserTransaction(
  userId: string,
  body: {
    amount: number
    type: 'expense' | 'income'
    category: string
    description?: string | null
    receipt_url?: string | null
    transacted_at: string
  },
) {
  const [created] = await createTransaction(userId, {
    amount: body.amount,
    type: body.type,
    category: body.category,
    description: body.description,
    receiptUrl: body.receipt_url,
    source: 'dashboard',
    transactedAt: body.transacted_at,
  })

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create transaction')
  }

  return mapTransaction(created)
}

export async function getUserTransaction(userId: string, transactionId: string) {
  const transaction = await getTransactionById(transactionId)

  if (!transaction) {
    throw new AppError('NOT_FOUND', 'Transaction not found')
  }

  assertOwner(transaction.userId, userId)

  return mapTransaction(transaction)
}

export async function patchUserTransaction(
  userId: string,
  transactionId: string,
  body: Partial<{
    amount: number
    type: 'expense' | 'income'
    category: string
    description: string | null
    receipt_url: string | null
    source: 'dashboard' | 'line' | 'discord'
    transacted_at: string
  }>,
) {
  const transaction = await getTransactionById(transactionId)

  if (!transaction) {
    throw new AppError('NOT_FOUND', 'Transaction not found')
  }

  assertOwner(transaction.userId, userId)

  const [updated] = await updateTransactionById(transactionId, {
    amount: body.amount,
    type: body.type,
    category: body.category,
    description: body.description,
    receiptUrl: body.receipt_url,
    source: body.source,
    transactedAt: body.transacted_at,
  })

  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update transaction')
  }

  return mapTransaction(updated)
}

export async function removeUserTransaction(userId: string, transactionId: string) {
  const transaction = await getTransactionById(transactionId)

  if (!transaction) {
    throw new AppError('NOT_FOUND', 'Transaction not found')
  }

  assertOwner(transaction.userId, userId)

  await deleteTransactionById(transactionId)
}

export async function getMonthlyTransactionSummary(userId: string, yearMonth?: string) {
  const targetYearMonth = yearMonth ?? getCurrentYearMonth()
  const summary = await getTransactionSummary(userId, targetYearMonth)

  return {
    year_month: targetYearMonth,
    total_expense: summary.totalExpense,
    total_income: summary.totalIncome,
    net_saving: summary.totalIncome - summary.totalExpense,
    by_category: summary.byCategory.map((row) => ({
      category: row.category,
      amount: row.amount,
      transaction_count: row.transactionCount,
    })),
  }
}

export async function uploadReceiptImage(userId: string, file: File) {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE = 10 * 1024 * 1024

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AppError('VALIDATION_ERROR', 'Only JPEG/PNG/WEBP files are allowed')
  }

  if (file.size > MAX_SIZE) {
    throw new AppError('VALIDATION_ERROR', 'File size must be 10MB or less')
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `${userId}/${Date.now()}-${sanitizedName}`

  await ensureBucketExists('receipts')

  const { error: uploadError } = await supabaseAdmin.storage
    .from('receipts')
    .upload(objectPath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new AppError('INTERNAL_ERROR', uploadError.message)
  }

  const { data } = supabaseAdmin.storage.from('receipts').getPublicUrl(objectPath)

  return {
    url: data.publicUrl,
  }
}

export async function getRecordingStreakDays(userId: string) {
  const streakDays = await getRecordingStreak(userId)
  return { streak_days: streakDays }
}

export async function getTransactionTrend(userId: string, range: '1m' | '3m' | '1y') {
  const now = new Date()

  if (range === '1y') {
    const since = new Date(now)
    since.setUTCMonth(since.getUTCMonth() - 12)
    const sinceDate = since.toISOString().slice(0, 10)
    const rows = await getMonthlyTrend(userId, sinceDate)
    return rows.map((row) => ({
      label: `${Number(row.yearMonth.slice(5))}月`,
      expense: row.expense,
      saving: row.income - row.expense,
    }))
  }

  if (range === '1m') {
    // 直近28日（今日-27日〜今日）
    const since = new Date(now)
    since.setUTCDate(since.getUTCDate() - 27)
    const sinceDate = since.toISOString().slice(0, 10)

    const [variableRows, fixedTotals] = await Promise.all([
      getDailyVariableTrend(userId, sinceDate),
      getMonthlyFixedExpenseTotals(userId, sinceDate),
    ])

    const variableMap = new Map(variableRows.map((r) => [r.day, r]))
    const fixedMap = new Map(fixedTotals.map((r) => [r.yearMonth, Number(r.fixedTotal)]))

    // 全28日を生成して各日に日割り固定費を加算
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - (27 - i))
      const dayStr = d.toISOString().slice(0, 10)
      const [yearStr, monthStr, dayPart] = dayStr.split('-')
      const yearMonth = `${yearStr}-${monthStr}`
      const daysInMonth = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getDate()

      const fixedTotal = fixedMap.get(yearMonth) ?? 0
      const proRatedFixed = fixedTotal / daysInMonth

      const row = variableMap.get(dayStr)
      const variableExpense = Number(row?.expense ?? 0)
      const income = Number(row?.income ?? 0)
      const totalExpense = variableExpense + proRatedFixed

      return {
        label: `${Number(monthStr)}/${Number(dayPart)}`,
        expense: Math.round(totalExpense),
        saving: Math.round(income - totalExpense),
      }
    })
  }

  // range === '3m': 直近91日を週別に集計
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - 91)
  const sinceDate = since.toISOString().slice(0, 10)

  const [variableRows, fixedTotals] = await Promise.all([
    getWeeklyVariableTrend(userId, sinceDate),
    getMonthlyFixedExpenseTotals(userId, sinceDate),
  ])

  const variableMap = new Map(variableRows.map((r) => [r.weekStart, r]))
  const fixedMap = new Map(fixedTotals.map((r) => [r.yearMonth, Number(r.fixedTotal)]))

  // since を含む週の月曜日から今日の週まで全週を生成
  const weekStarts = generateWeekStarts(since, now)

  return weekStarts.map((weekStart) => {
    const [yearStr, monthStr, dayPart] = weekStart.split('-')
    const daysInMonth = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getDate()
    const yearMonth = `${yearStr}-${monthStr}`

    const fixedTotal = fixedMap.get(yearMonth) ?? 0
    // 週の開始月を基準に、月の固定費を日割り×7日分で週割り換算
    const proRatedFixed = (fixedTotal * 7) / daysInMonth

    const row = variableMap.get(weekStart)
    const variableExpense = Number(row?.expense ?? 0)
    const income = Number(row?.income ?? 0)
    const totalExpense = variableExpense + proRatedFixed

    return {
      label: `${Number(monthStr)}/${Number(dayPart)}`,
      expense: Math.round(totalExpense),
      saving: Math.round(income - totalExpense),
    }
  })
}

/** since を含む ISO 週（月曜始まり）の先頭月曜日から until の週まで全週の月曜日を返す */
function generateWeekStarts(since: Date, until: Date): string[] {
  // since が属する週の月曜を求める（ISO週: 月曜=1, 日曜=0→7）
  const startMonday = new Date(since)
  const day = startMonday.getUTCDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  startMonday.setUTCDate(startMonday.getUTCDate() - daysToMonday)

  const weeks: string[] = []
  const current = new Date(startMonday)
  while (current <= until) {
    weeks.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 7)
  }
  return weeks
}

export async function getBudgetSpentSummary(userId: string, yearMonth: string) {
  const [spentByCategory, totalSpent] = await Promise.all([
    getSpentAmountsByCategory(userId, yearMonth),
    getTotalSpent(userId, yearMonth),
  ])

  return {
    spentByCategory,
    totalSpent,
  }
}

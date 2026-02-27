import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  sql,
  type SQL,
} from 'drizzle-orm'

import { db } from '../client'
import { budgets, transactions } from '../schema'

const SORT_COLUMN_MAP = {
  transacted_at: transactions.transactedAt,
  amount: transactions.amount,
  created_at: transactions.createdAt,
} as const

type ListFilters = {
  yearMonth?: string
  category?: string
  type?: 'expense' | 'income'
  source?: 'dashboard' | 'line' | 'discord'
  keyword?: string
  page: number
  limit: number
  sort: keyof typeof SORT_COLUMN_MAP
  order: 'asc' | 'desc'
}

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map((part) => Number(part))
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 1))

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function buildWhereClause(userId: string, filters: ListFilters) {
  const conditions: SQL[] = [eq(transactions.userId, userId)]

  if (filters.yearMonth) {
    const { from, to } = getMonthRange(filters.yearMonth)
    conditions.push(gte(transactions.transactedAt, from), lt(transactions.transactedAt, to))
  }

  if (filters.category) {
    conditions.push(eq(transactions.category, filters.category))
  }

  if (filters.type) {
    conditions.push(eq(transactions.type, filters.type))
  }

  if (filters.source) {
    conditions.push(eq(transactions.source, filters.source))
  }

  if (filters.keyword) {
    conditions.push(ilike(transactions.description, `%${filters.keyword}%`))
  }

  return and(...conditions)
}

export async function listTransactions(userId: string, filters: ListFilters) {
  const where = buildWhereClause(userId, filters)
  const offset = (filters.page - 1) * filters.limit
  const orderBy =
    filters.order === 'asc'
      ? asc(SORT_COLUMN_MAP[filters.sort])
      : desc(SORT_COLUMN_MAP[filters.sort])

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(orderBy)
      .limit(filters.limit)
      .offset(offset),
    db.select({ total: count() }).from(transactions).where(where),
  ])

  return {
    rows,
    total: totalRows[0]?.total ?? 0,
  }
}

export function createTransaction(
  userId: string,
  data: {
    amount: number
    type: 'expense' | 'income'
    category: string
    description?: string | null
    receiptUrl?: string | null
    source?: 'dashboard' | 'line' | 'discord'
    transactedAt: string
  },
) {
  return db
    .insert(transactions)
    .values({
      userId,
      amount: data.amount,
      type: data.type,
      category: data.category,
      description: data.description ?? null,
      receiptUrl: data.receiptUrl ?? null,
      source: data.source ?? 'dashboard',
      transactedAt: data.transactedAt,
    })
    .returning()
}

export async function getTransactionById(id: string) {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1)
  return rows[0] ?? null
}

export function updateTransactionById(
  id: string,
  data: Partial<{
    amount: number
    type: 'expense' | 'income'
    category: string
    description: string | null
    receiptUrl: string | null
    source: 'dashboard' | 'line' | 'discord'
    transactedAt: string
  }>,
) {
  return db
    .update(transactions)
    .set(data)
    .where(eq(transactions.id, id))
    .returning()
}

export function deleteTransactionById(id: string) {
  return db.delete(transactions).where(eq(transactions.id, id)).returning({ id: transactions.id })
}

export async function getTransactionSummary(userId: string, yearMonth: string) {
  const { from, to } = getMonthRange(yearMonth)

  const [totals, byCategory] = await Promise.all([
    db
      .select({
        totalExpense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
        totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.transactedAt, from),
          lt(transactions.transactedAt, to),
        ),
      ),
    db
      .select({
        category: transactions.category,
        amount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        transactionCount: count(transactions.id),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          gte(transactions.transactedAt, from),
          lt(transactions.transactedAt, to),
        ),
      )
      .groupBy(transactions.category)
      .orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`)),
  ])

  return {
    totalExpense: totals[0]?.totalExpense ?? 0,
    totalIncome: totals[0]?.totalIncome ?? 0,
    byCategory,
  }
}

export async function getSpentAmountsByCategory(userId: string, yearMonth: string) {
  const { from, to } = getMonthRange(yearMonth)

  const rows = await db
    .select({
      category: transactions.category,
      amount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.transactedAt, from),
        lt(transactions.transactedAt, to),
      ),
    )
    .groupBy(transactions.category)

  return new Map(rows.map((row) => [row.category, row.amount]))
}

export async function getTotalSpent(userId: string, yearMonth: string) {
  const { from, to } = getMonthRange(yearMonth)

  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.transactedAt, from),
        lt(transactions.transactedAt, to),
      ),
    )

  return rows[0]?.total ?? 0
}

export async function countTodayTransactions(userId: string, todayDate: string): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.transactedAt, todayDate),
      ),
    )
  return rows[0]?.total ?? 0
}

export async function getRecordingStreak(userId: string): Promise<number> {
  const rows = await db
    .selectDistinct({ day: transactions.transactedAt })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.transactedAt))

  if (rows.length === 0) return 0

  const dateSet = new Set(rows.map((r) => r.day))

  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  const todayStr = todayUTC.toISOString().slice(0, 10)
  const yesterdayStr = new Date(todayUTC.getTime() - 86400000).toISOString().slice(0, 10)

  // 今日記録があればそこから、なければ昨日から遡る
  let startStr: string
  if (dateSet.has(todayStr)) {
    startStr = todayStr
  } else if (dateSet.has(yesterdayStr)) {
    startStr = yesterdayStr
  } else {
    return 0
  }

  let streak = 0
  let current = new Date(`${startStr}T00:00:00Z`)

  while (true) {
    const checkStr = current.toISOString().slice(0, 10)
    if (dateSet.has(checkStr)) {
      streak++
      current = new Date(current.getTime() - 86400000)
    } else {
      break
    }
  }

  return streak
}

export async function getDailyTrend(userId: string, since: string) {
  return db
    .select({
      day: sql<string>`to_char(${transactions.transactedAt}::date, 'YYYY-MM-DD')`,
      expense:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      income:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.transactedAt, since)))
    .groupBy(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM-DD')`))
}

export async function getWeeklyTrend(userId: string, since: string) {
  return db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${transactions.transactedAt}::date), 'YYYY-MM-DD')`,
      expense:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      income:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.transactedAt, since)))
    .groupBy(sql`date_trunc('week', ${transactions.transactedAt}::date)`)
    .orderBy(asc(sql`date_trunc('week', ${transactions.transactedAt}::date)`))
}

export async function getMonthlyTrend(userId: string, since: string) {
  return db
    .select({
      yearMonth: sql<string>`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`,
      expense:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      income:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.transactedAt, since)))
    .groupBy(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`))
}

/** 変動費のみ（is_fixed=falseまたは予算未設定のカテゴリ）を日別集計 */
export async function getDailyVariableTrend(userId: string, since: string) {
  return db
    .select({
      day: sql<string>`to_char(${transactions.transactedAt}::date, 'YYYY-MM-DD')`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND (${budgets.isFixed} IS NULL OR ${budgets.isFixed} = false) THEN ${transactions.amount} ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(
      budgets,
      and(
        eq(budgets.userId, transactions.userId),
        eq(budgets.yearMonth, sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`),
        eq(budgets.category, transactions.category),
      ),
    )
    .where(and(eq(transactions.userId, userId), gte(transactions.transactedAt, since)))
    .groupBy(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM-DD')`))
}

/** 変動費のみを週別集計 */
export async function getWeeklyVariableTrend(userId: string, since: string) {
  return db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${transactions.transactedAt}::date), 'YYYY-MM-DD')`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND (${budgets.isFixed} IS NULL OR ${budgets.isFixed} = false) THEN ${transactions.amount} ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(
      budgets,
      and(
        eq(budgets.userId, transactions.userId),
        eq(budgets.yearMonth, sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`),
        eq(budgets.category, transactions.category),
      ),
    )
    .where(and(eq(transactions.userId, userId), gte(transactions.transactedAt, since)))
    .groupBy(sql`date_trunc('week', ${transactions.transactedAt}::date)`)
    .orderBy(asc(sql`date_trunc('week', ${transactions.transactedAt}::date)`))
}

/** 固定費（is_fixed=true）の月別合計 */
export async function getMonthlyFixedExpenseTotals(userId: string, since: string) {
  return db
    .select({
      yearMonth: sql<string>`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`,
      fixedTotal: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(
      budgets,
      and(
        eq(budgets.userId, transactions.userId),
        eq(budgets.yearMonth, sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`),
        eq(budgets.category, transactions.category),
        eq(budgets.isFixed, true),
      ),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.transactedAt, since),
      ),
    )
    .groupBy(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`))
}

export async function listRecentMonthlyExpenseTotals(userId: string, months: number) {
  const since = new Date()
  since.setUTCMonth(since.getUTCMonth() - (months - 1))
  const sinceDate = since.toISOString().slice(0, 10)

  return db
    .select({
      yearMonth: sql<string>`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`,
      totalExpense:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.transactedAt, sinceDate)))
    .groupBy(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(${transactions.transactedAt}::date, 'YYYY-MM')`))
}

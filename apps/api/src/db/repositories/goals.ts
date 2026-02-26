import { and, asc, desc, eq, max } from 'drizzle-orm'

import { db } from '../client'
import { lifeGoals } from '../schema'

export function listGoals(userId: string, status?: 'active' | 'paused' | 'completed') {
  return db
    .select()
    .from(lifeGoals)
    .where(
      status
        ? and(eq(lifeGoals.userId, userId), eq(lifeGoals.status, status))
        : eq(lifeGoals.userId, userId),
    )
    .orderBy(asc(lifeGoals.sortOrder))
}

export async function getNextSortOrder(userId: string) {
  const rows = await db
    .select({ maxSortOrder: max(lifeGoals.sortOrder) })
    .from(lifeGoals)
    .where(eq(lifeGoals.userId, userId))

  return (rows[0]?.maxSortOrder ?? 0) + 1
}

export function createGoal(
  userId: string,
  data: {
    title: string
    icon: string
    targetAmount: number
    savedAmount: number
    monthlySaving: number
    targetYear: number
    priority: '高' | '中' | '低'
    sortOrder: number
  },
) {
  return db
    .insert(lifeGoals)
    .values({
      userId,
      title: data.title,
      icon: data.icon,
      targetAmount: data.targetAmount,
      savedAmount: data.savedAmount,
      monthlySaving: data.monthlySaving,
      targetYear: data.targetYear,
      priority: data.priority,
      status: 'active',
      sortOrder: data.sortOrder,
    })
    .returning()
}

export async function getGoalById(id: string) {
  const rows = await db.select().from(lifeGoals).where(eq(lifeGoals.id, id)).limit(1)
  return rows[0] ?? null
}

export function updateGoalById(
  id: string,
  data: Partial<{
    title: string
    icon: string
    targetAmount: number
    savedAmount: number
    monthlySaving: number
    targetYear: number
    priority: '高' | '中' | '低'
    status: 'active' | 'paused' | 'completed'
  }>,
) {
  return db
    .update(lifeGoals)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(lifeGoals.id, id))
    .returning()
}

export function deleteGoalById(id: string) {
  return db.delete(lifeGoals).where(eq(lifeGoals.id, id)).returning({ id: lifeGoals.id })
}

export async function reorderGoals(
  userId: string,
  orders: Array<{ id: string; sortOrder: number }>,
) {
  return db.transaction(async (tx) => {
    let updatedCount = 0

    for (const order of orders) {
      const updated = await tx
        .update(lifeGoals)
        .set({
          sortOrder: order.sortOrder,
          updatedAt: new Date(),
        })
        .where(and(eq(lifeGoals.id, order.id), eq(lifeGoals.userId, userId)))
        .returning({ id: lifeGoals.id })

      if (updated.length > 0) {
        updatedCount += 1
      }
    }

    return updatedCount
  })
}

export async function listGoalsByNewestUpdate(userId: string) {
  return db
    .select()
    .from(lifeGoals)
    .where(eq(lifeGoals.userId, userId))
    .orderBy(desc(lifeGoals.updatedAt))
}

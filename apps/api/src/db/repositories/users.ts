import { eq } from 'drizzle-orm'

import { db } from '../client'
import { users } from '../schema'

export function createUser(
  userId: string,
  data: { displayName: string; monthlyIncome: number },
) {
  return db
    .insert(users)
    .values({
      id: userId,
      displayName: data.displayName,
      monthlyIncome: data.monthlyIncome,
    })
    .returning()
}

export async function getUserById(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return rows[0] ?? null
}

export function updateUser(
  userId: string,
  data: Partial<{
    displayName: string
    monthlyIncome: number
    notificationReminder: boolean
    notificationWeekly: boolean
    notificationMonthly: boolean
    notificationLine: boolean
    notificationDiscord: boolean
  }>,
) {
  return db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()
}

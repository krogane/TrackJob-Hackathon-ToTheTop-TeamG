import { createUser, getUserById, updateUser } from '../db/repositories/users'
import { AppError } from '../lib/errors'
import { toIsoString } from './serializers'

type ProfileRow = {
  id: string
  displayName: string
  monthlyIncome: number
  notificationReminder: boolean
  notificationWeekly: boolean
  notificationMonthly: boolean
  notificationLine: boolean
  notificationDiscord: boolean
  createdAt: Date
  updatedAt: Date
}

function mapProfileForGet(row: ProfileRow) {
  return {
    id: row.id,
    display_name: row.displayName,
    monthly_income: row.monthlyIncome,
    notification_reminder: row.notificationReminder,
    notification_weekly: row.notificationWeekly,
    notification_monthly: row.notificationMonthly,
    notification_line: row.notificationLine,
    notification_discord: row.notificationDiscord,
    created_at: toIsoString(row.createdAt),
    updated_at: toIsoString(row.updatedAt),
  }
}

function mapProfileForCreate(row: ProfileRow) {
  return {
    id: row.id,
    display_name: row.displayName,
    monthly_income: row.monthlyIncome,
    notification_reminder: row.notificationReminder,
    notification_weekly: row.notificationWeekly,
    notification_monthly: row.notificationMonthly,
    notification_line: row.notificationLine,
    notification_discord: row.notificationDiscord,
    created_at: toIsoString(row.createdAt),
  }
}

function mapProfileForPatch(row: ProfileRow) {
  return {
    id: row.id,
    display_name: row.displayName,
    monthly_income: row.monthlyIncome,
    notification_reminder: row.notificationReminder,
    notification_weekly: row.notificationWeekly,
    notification_monthly: row.notificationMonthly,
    notification_line: row.notificationLine,
    notification_discord: row.notificationDiscord,
    updated_at: toIsoString(row.updatedAt),
  }
}

export async function createProfile(
  userId: string,
  data: { display_name: string; monthly_income: number },
) {
  const existing = await getUserById(userId)
  if (existing) {
    throw new AppError('CONFLICT', 'Profile already exists')
  }

  const [created] = await createUser(userId, {
    displayName: data.display_name,
    monthlyIncome: data.monthly_income,
  })

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create profile')
  }

  return mapProfileForCreate(created)
}

export async function getProfile(userId: string) {
  const profile = await getUserById(userId)

  if (!profile) {
    throw new AppError('NOT_FOUND', 'Profile not found')
  }

  return mapProfileForGet(profile)
}

export async function patchProfile(
  userId: string,
  data: Partial<{
    display_name: string
    monthly_income: number
    notification_reminder: boolean
    notification_weekly: boolean
    notification_monthly: boolean
    notification_line: boolean
    notification_discord: boolean
  }>,
) {
  const existing = await getUserById(userId)
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Profile not found')
  }

  const [updated] = await updateUser(userId, {
    displayName: data.display_name,
    monthlyIncome: data.monthly_income,
    notificationReminder: data.notification_reminder,
    notificationWeekly: data.notification_weekly,
    notificationMonthly: data.notification_monthly,
    notificationLine: data.notification_line,
    notificationDiscord: data.notification_discord,
  })

  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update profile')
  }

  return mapProfileForPatch(updated)
}

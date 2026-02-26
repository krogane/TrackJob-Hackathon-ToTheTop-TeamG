import {
  createGoal,
  deleteGoalById,
  getGoalById,
  getNextSortOrder,
  listGoals,
  reorderGoals,
  updateGoalById,
} from '../db/repositories/goals'
import { AppError } from '../lib/errors'
import { toIsoString } from './serializers'

function assertOwner(resourceUserId: string, userId: string) {
  if (resourceUserId !== userId) {
    throw new AppError('FORBIDDEN', 'Access to this resource is forbidden')
  }
}

function progressRate(savedAmount: number, targetAmount: number) {
  if (targetAmount <= 0) {
    return 0
  }
  return Number((savedAmount / targetAmount).toFixed(4))
}

function mapGoal(row: {
  id: string
  title: string
  icon: string
  targetAmount: number
  savedAmount: number
  monthlySaving: number
  targetYear: number
  priority: '高' | '中' | '低'
  status: 'active' | 'paused' | 'completed'
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    target_amount: row.targetAmount,
    saved_amount: row.savedAmount,
    monthly_saving: row.monthlySaving,
    target_year: row.targetYear,
    priority: row.priority,
    status: row.status,
    sort_order: row.sortOrder,
    progress_rate: progressRate(row.savedAmount, row.targetAmount),
    created_at: toIsoString(row.createdAt),
    updated_at: toIsoString(row.updatedAt),
  }
}

export async function listUserGoals(userId: string, status?: 'active' | 'paused' | 'completed') {
  const rows = await listGoals(userId, status)
  return rows.map(mapGoal)
}

export async function createUserGoal(
  userId: string,
  body: {
    title: string
    icon?: string
    target_amount: number
    saved_amount?: number
    monthly_saving: number
    target_year: number
    priority: '高' | '中' | '低'
  },
) {
  const sortOrder = await getNextSortOrder(userId)

  const [created] = await createGoal(userId, {
    title: body.title,
    icon: body.icon ?? '🎯',
    targetAmount: body.target_amount,
    savedAmount: body.saved_amount ?? 0,
    monthlySaving: body.monthly_saving,
    targetYear: body.target_year,
    priority: body.priority,
    sortOrder,
  })

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create goal')
  }

  return mapGoal(created)
}

export async function patchUserGoal(
  userId: string,
  goalId: string,
  body: Partial<{
    title: string
    icon: string
    target_amount: number
    saved_amount: number
    monthly_saving: number
    target_year: number
    priority: '高' | '中' | '低'
    status: 'active' | 'paused' | 'completed'
  }>,
) {
  const existing = await getGoalById(goalId)

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Goal not found')
  }

  assertOwner(existing.userId, userId)

  const [updated] = await updateGoalById(goalId, {
    title: body.title,
    icon: body.icon,
    targetAmount: body.target_amount,
    savedAmount: body.saved_amount,
    monthlySaving: body.monthly_saving,
    targetYear: body.target_year,
    priority: body.priority,
    status: body.status,
  })

  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update goal')
  }

  return mapGoal(updated)
}

export async function deleteUserGoal(userId: string, goalId: string) {
  const existing = await getGoalById(goalId)

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Goal not found')
  }

  assertOwner(existing.userId, userId)

  await deleteGoalById(goalId)
}

export async function reorderUserGoals(
  userId: string,
  orders: Array<{ id: string; sort_order: number }>,
) {
  const updatedCount = await reorderGoals(
    userId,
    orders.map((order) => ({ id: order.id, sortOrder: order.sort_order })),
  )

  return {
    updated_count: updatedCount,
  }
}

export const GOAL_PRIORITIES = ['高', '中', '低'] as const
export const GOAL_STATUSES = ['active', 'paused', 'completed'] as const

export type GoalPriority = (typeof GOAL_PRIORITIES)[number]
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export interface LifeGoal {
  id: string
  title: string
  icon: string
  target_amount: number
  saved_amount: number
  monthly_saving: number
  target_year: number
  priority: GoalPriority
  status: GoalStatus
  sort_order: number
  progress_rate: number
  created_at: string
  updated_at: string
}

export type Goal = LifeGoal

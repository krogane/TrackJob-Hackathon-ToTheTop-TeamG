export interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

export type ChatWizardGoalPriority = '高' | '中' | '低' | 'unknown'
export type ChatWizardGoalAmount = number | 'unknown'
export type ChatWizardGoalYear = number | 'unknown'

export interface ChatWizardGoalConfig {
  title: string
  target_amount: ChatWizardGoalAmount
  target_year: ChatWizardGoalYear
  priority: ChatWizardGoalPriority
}

export interface ChatSetupContext {
  monthly_income?: number
  current_savings?: number
  housing_cost?: number
  daily_food_cost?: number
}

export interface ChatWizardConfig {
  monthly_income: number
  monthly_savings_target: number
  current_savings?: number
  life_goals: ChatWizardGoalConfig[]
  suggested_budgets: Record<string, number>
}

export interface ChatResponse {
  role: 'model'
  content: string
  is_complete: boolean
  config: ChatWizardConfig | null
}

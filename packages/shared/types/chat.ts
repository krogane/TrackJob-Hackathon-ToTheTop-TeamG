export interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

export interface ChatWizardGoalConfig {
  title: string
  icon: string
  target_amount: number
  monthly_saving: number
  target_year: number
  priority: '高' | '中' | '低'
}

export interface ChatWizardConfig {
  monthly_income: number
  monthly_savings_target: number
  life_goals: ChatWizardGoalConfig[]
  suggested_budgets: Record<string, number>
}

export interface ChatResponse {
  role: 'model'
  content: string
  is_complete: boolean
  config: ChatWizardConfig | null
}

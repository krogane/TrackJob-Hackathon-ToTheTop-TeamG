import type {
  ChatMessage,
  ChatResponse,
  ChatSetupContext,
  ChatWizardConfig,
} from '@lifebalance/shared/types'

import {
  GEMINI_BUDGET_MODEL,
  extractFirstJsonObject,
  generateGeminiChat,
  generateGeminiText,
} from './gemini'
import { getChatSystemPrompt } from './prompts/chat'
import { chatExtractedConfigSchema } from '../schemas/chat'

const BUDGET_CATEGORIES = [
  'housing',
  'food',
  'transport',
  'entertainment',
  'clothing',
  'communication',
  'medical',
  'social',
  'other',
] as const

type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]
type BudgetRecord = Record<BudgetCategory, number>
type ChatExtractedConfig = Pick<ChatWizardConfig, 'monthly_savings_target' | 'life_goals'>

function toNonNegativeInt(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed))
}

function extractSetupCompleteTag(content: string) {
  const match = content.match(/<SETUP_COMPLETE\s*\/>/i)
  if (!match) {
    return {
      hasSetupCompleteTag: false,
      cleanedContent: content.trim(),
    }
  }

  return {
    hasSetupCompleteTag: true,
    cleanedContent: content.replace(match[0], '').trim(),
  }
}

function normalizeUnknownString(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'unknown' || normalized === '不明' || normalized === '未定') {
    return 'unknown' as const
  }
  return value
}

function normalizePriority(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()

  if (value === '高' || normalized === 'high') return '高'
  if (value === '中' || normalized === 'medium' || normalized === 'mid') return '中'
  if (value === '低' || normalized === 'low') return '低'
  if (normalized === 'unknown' || normalized === '不明' || normalized === '未定') return 'unknown'

  return value
}

function normalizeSetupContext(setupContext: ChatSetupContext | null): ChatSetupContext | null {
  if (!setupContext) return null

  const monthlyIncome = toNonNegativeInt(setupContext.monthly_income)
  const currentSavings = toNonNegativeInt(setupContext.current_savings)
  const housingCost = toNonNegativeInt(setupContext.housing_cost)
  const dailyFoodCost = toNonNegativeInt(setupContext.daily_food_cost)

  return {
    ...(monthlyIncome === null ? {} : { monthly_income: monthlyIncome }),
    ...(currentSavings === null ? {} : { current_savings: currentSavings }),
    ...(housingCost === null ? {} : { housing_cost: housingCost }),
    ...(dailyFoodCost === null ? {} : { daily_food_cost: dailyFoodCost }),
  }
}

function normalizeExtractedConfigData(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const obj = { ...(raw as Record<string, unknown>) }
  const currentYear = new Date().getUTCFullYear()

  if (typeof obj.monthly_savings_target === 'number') {
    obj.monthly_savings_target = Math.round(obj.monthly_savings_target)
  }

  if (Array.isArray(obj.life_goals)) {
    obj.life_goals = obj.life_goals.map((goal: unknown) => {
      if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return goal
      const g = { ...(goal as Record<string, unknown>) }

      if (typeof g.target_amount === 'number') {
        g.target_amount = Math.round(g.target_amount)
      } else if (typeof g.target_amount === 'string') {
        g.target_amount = normalizeUnknownString(g.target_amount)
      }

      if (typeof g.target_year === 'number') {
        g.target_year = Math.max(Math.round(g.target_year), currentYear)
      } else if (typeof g.target_year === 'string') {
        g.target_year = normalizeUnknownString(g.target_year)
      }

      g.priority = normalizePriority(g.priority)

      return g
    })
  }

  return obj
}

function parseExtractedConfig(content: string): ChatExtractedConfig | null {
  try {
    const parsedJson = JSON.parse(content) as unknown
    const normalized = normalizeExtractedConfigData(parsedJson)
    const parsed = chatExtractedConfigSchema.safeParse(normalized)
    if (!parsed.success) {
      console.warn('[chat] extracted CONFIG validation failed:', JSON.stringify(parsed.error.issues))
    }
    return parsed.success ? parsed.data : null
  } catch (err) {
    console.warn('[chat] extracted CONFIG JSON parse error:', err)
    return null
  }
}

function getSetupMonthlyFoodCost(setupContext: ChatSetupContext | null) {
  const dailyFoodCost = setupContext?.daily_food_cost
  if (dailyFoodCost === undefined) {
    return null
  }
  return Math.max(0, Math.round(dailyFoodCost * 30))
}

function createEmptyBudgets(): BudgetRecord {
  return {
    housing: 0,
    food: 0,
    transport: 0,
    entertainment: 0,
    clothing: 0,
    communication: 0,
    medical: 0,
    social: 0,
    other: 0,
  }
}

function sanitizeBudgetObject(raw: unknown): Partial<BudgetRecord> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const record = raw as Record<string, unknown>
  const next: Partial<BudgetRecord> = {}

  for (const category of BUDGET_CATEGORIES) {
    const value = record[category]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue
    }
    next[category] = Math.max(0, Math.round(value))
  }

  return next
}

function fitBudgetsToCapacity(
  budgets: BudgetRecord,
  monthlyIncome: number,
  monthlySavingsTarget: number,
  lockedCategories: BudgetCategory[],
) {
  if (monthlyIncome <= 0) return budgets

  const maxSpending = Math.max(0, monthlyIncome - monthlySavingsTarget)
  const total = BUDGET_CATEGORIES.reduce((sum, category) => sum + budgets[category], 0)
  if (total <= maxSpending) return budgets

  const locked = new Set(lockedCategories)
  const lockedTotal = BUDGET_CATEGORIES.reduce(
    (sum, category) => (locked.has(category) ? sum + budgets[category] : sum),
    0,
  )
  const availableForFlexible = Math.max(0, maxSpending - lockedTotal)

  const flexibleCategories = BUDGET_CATEGORIES.filter((category) => !locked.has(category))
  const flexibleTotal = flexibleCategories.reduce((sum, category) => sum + budgets[category], 0)
  if (flexibleTotal <= 0) return budgets

  const scaled = { ...budgets }
  const scale = availableForFlexible / flexibleTotal
  for (const category of flexibleCategories) {
    scaled[category] = Math.max(0, Math.round(scaled[category] * scale))
  }
  return scaled
}

function buildFallbackBudgets(config: ChatWizardConfig, setupContext: ChatSetupContext | null): BudgetRecord {
  const monthlyIncome = Math.max(0, Math.round(config.monthly_income))
  const monthlySavingsTarget = Math.max(0, Math.round(config.monthly_savings_target))
  const housingCost = setupContext?.housing_cost

  const housing = housingCost !== undefined
    ? Math.max(0, Math.round(housingCost))
    : monthlyIncome > 0
      ? Math.round(monthlyIncome * 0.25)
      : 0

  const food = getSetupMonthlyFoodCost(setupContext) ?? (monthlyIncome > 0 ? Math.round(monthlyIncome * 0.12) : 0)

  const spendingUpperBound = monthlyIncome > 0 ? Math.max(0, monthlyIncome - monthlySavingsTarget) : 0
  const remaining = Math.max(0, spendingUpperBound - housing - food)

  const variableWeights: Record<Exclude<BudgetCategory, 'housing' | 'food'>, number> = {
    transport: 0.14,
    entertainment: 0.18,
    clothing: 0.12,
    communication: 0.14,
    medical: 0.1,
    social: 0.16,
    other: 0.16,
  }

  const budgets: BudgetRecord = {
    housing,
    food,
    transport: 0,
    entertainment: 0,
    clothing: 0,
    communication: 0,
    medical: 0,
    social: 0,
    other: 0,
  }

  for (const [category, weight] of Object.entries(variableWeights) as Array<
    [Exclude<BudgetCategory, 'housing' | 'food'>, number]
  >) {
    budgets[category] = Math.max(0, Math.round(remaining * weight))
  }

  return fitBudgetsToCapacity(budgets, monthlyIncome, monthlySavingsTarget, ['housing', 'food'])
}

async function generateSuggestedBudgetsWithLLM(
  config: ChatWizardConfig,
  setupContext: ChatSetupContext | null,
  messages: ChatMessage[],
) {
  const fallbackBudgets = buildFallbackBudgets(config, setupContext)
  const monthlyIncome = Math.max(0, Math.round(config.monthly_income))
  const monthlySavingsTarget = Math.max(0, Math.round(config.monthly_savings_target))
  const setupHousingCost = setupContext?.housing_cost
  const housingCost = setupHousingCost !== undefined
    ? Math.max(0, Math.round(setupHousingCost))
    : null
  const monthlyFoodCost = getSetupMonthlyFoodCost(setupContext)

  const conversationText = messages
    .map((message) => `${message.role === 'user' ? 'ユーザー' : 'AI'}: ${message.content}`)
    .join('\n')

  const prompt = `
あなたは家計予算配分の専門AIです。
以下の条件を元に suggested_budgets を JSON のみで出力してください。

## ルール
- 値はすべて0以上の整数（円）
- 合計は月収（${monthlyIncome}円）- 貯蓄目標（${monthlySavingsTarget}円）をできるだけ超えない。

## 固定条件
- housing は ${housingCost !== null ? `${housingCost}円で固定` : '会話文脈から推定'}
- food は ${monthlyFoodCost !== null ? `${monthlyFoodCost}円で固定` : '会話文脈から推定'}

## 会話文脈（節約の意思など）
${conversationText}

## 期待する形式
{
  "housing": 0,
  "food": 0,
  "transport": 0,
  "entertainment": 0,
  "clothing": 0,
  "communication": 0,
  "medical": 0,
  "social": 0,
  "other": 0
}
`.trim()

  try {
    const raw = await generateGeminiText({
      model: GEMINI_BUDGET_MODEL,
      prompt,
    })

    const json = extractFirstJsonObject(raw)
    if (!json) {
      console.warn('[chat] budget generation: no JSON object found')
      return fallbackBudgets
    }

    const parsed = sanitizeBudgetObject(JSON.parse(json))
    const merged = {
      ...createEmptyBudgets(),
      ...fallbackBudgets,
      ...parsed,
    }

    if (housingCost !== null) {
      merged.housing = housingCost
    }
    if (monthlyFoodCost !== null) {
      merged.food = monthlyFoodCost
    }

    return fitBudgetsToCapacity(merged, monthlyIncome, monthlySavingsTarget, ['housing', 'food'])
  } catch (error) {
    console.warn('[chat] budget generation failed:', error)
    return fallbackBudgets
  }
}

function mergeConfigWithSetupContext(
  config: ChatExtractedConfig,
  setupContext: ChatSetupContext | null,
): ChatWizardConfig {
  const setupMonthlyIncome = setupContext?.monthly_income
  const setupCurrentSavings = setupContext?.current_savings

  const monthlyIncome = setupMonthlyIncome !== undefined ? Math.max(0, Math.round(setupMonthlyIncome)) : 0

  const currentSavings = setupCurrentSavings !== undefined
    ? Math.max(0, Math.round(setupCurrentSavings))
    : undefined

  return {
    monthly_income: monthlyIncome,
    monthly_savings_target: Math.max(0, Math.round(config.monthly_savings_target)),
    life_goals: config.life_goals,
    suggested_budgets: {},
    ...(currentSavings === undefined ? {} : { current_savings: currentSavings }),
  }
}

async function extractConfigFromHistory(
  messages: ChatMessage[],
) {
  const currentYear = new Date().getUTCFullYear()
  const conversationText = messages
    .map((message) => `${message.role === 'user' ? 'ユーザー' : 'AI'}: ${message.content}`)
    .join('\n')

  const prompt = `
以下の会話・文脈から家計設定情報を抽出し、JSONのみを返してください（説明文は不要）。金額の単位は円であることを留意してください。

  ## 現在の日付
今日は${currentYear}年です。「N年後」はこの年を基準に計算してください（例：1年後=${currentYear + 1}年）。

--- 会話 ---
${conversationText}
--- ここまで ---

## 各項目の内容
- monthly_savings_target: 月収（手取り）と節約の意思をもとに金額を決定し、記入します。
- life_goals(title): ライフプランのタイトルを簡潔に記入します。目標が存在しない場合は、文字列"unknown"を記入します。
- life_goals(target_amount): ライフプランに必要な金額を整数で記入します。不明な場合は、文字列"unknown"を記入します。
- life_goals(target_year): ライフプランを達成したい年を整数で記入します。ただし、${currentYear+1}以降の年である必要があります。不明な場合は、文字列"unknown"を記入します。
- life_goals(priority): 客観的に見たライフプランの壮大さによって決定します。「高」「中」「低」または "unknown"を記入します。
- 出力キーは "monthly_savings_target" と "life_goals" の2つのみを使用してください。

## 出力形式の例
{
  "monthly_savings_target": 50000,
  "life_goals": [
    {
      "title": "マイホーム購入",
      "target_amount": 5000000,
      "target_year": 2030,
      "priority": "高"
    }
  ]
}
`.trim()

  try {
    const rawJson = await generateGeminiText({ prompt })
    const json = extractFirstJsonObject(rawJson)
    if (!json) {
      console.warn('[chat] extraction: no JSON object found in response')
      return null
    }
    return parseExtractedConfig(json)
  } catch (error) {
    console.warn('[chat] extraction call failed:', error)
    return null
  }
}

async function finalizeConfig(
  config: ChatExtractedConfig,
  messages: ChatMessage[],
  setupContext: ChatSetupContext | null,
) {
  const mergedConfig = mergeConfigWithSetupContext(config, setupContext)
  const suggestedBudgets = await generateSuggestedBudgetsWithLLM(
    mergedConfig,
    setupContext,
    messages,
  )

  return {
    ...mergedConfig,
    suggested_budgets: suggestedBudgets,
  }
}

export async function generateChatResponse(
  messages: ChatMessage[],
  setupContext: ChatSetupContext | null = null,
): Promise<ChatResponse> {
  const normalizedSetupContext = normalizeSetupContext(setupContext)

  const rawContent = await generateGeminiChat({
    systemInstruction: getChatSystemPrompt(normalizedSetupContext),
    history: messages,
  })

  const { hasSetupCompleteTag, cleanedContent } = extractSetupCompleteTag(rawContent)

  if (hasSetupCompleteTag) {
    console.info('[chat] <SETUP_COMPLETE/> detected, extracting config from history')
    const messagesWithCompletion: ChatMessage[] = [...messages, { role: 'model', content: rawContent }]
    const extractedConfig = await extractConfigFromHistory(messagesWithCompletion)
    if (extractedConfig) {
      const finalizedConfig = await finalizeConfig(
        extractedConfig,
        messagesWithCompletion,
        normalizedSetupContext,
      )
      return {
        role: 'model',
        content: cleanedContent || rawContent.trim(),
        is_complete: true,
        config: finalizedConfig,
      }
    }
    console.warn('[chat] <SETUP_COMPLETE/> detected, but config extraction failed')
  }

  return {
    role: 'model',
    content: cleanedContent || rawContent.trim(),
    is_complete: false,
    config: null,
  }
}

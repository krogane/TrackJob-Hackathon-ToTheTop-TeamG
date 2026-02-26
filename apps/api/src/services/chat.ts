import type { ChatMessage, ChatResponse } from '@lifebalance/shared/types'

import { generateGeminiChat } from './gemini'
import { getChatSystemPrompt } from './prompts/chat'
import { chatConfigSchema } from '../schemas/chat'

function extractConfigTag(content: string) {
  const match = content.match(/<CONFIG>([\s\S]*?)<\/CONFIG>/i)
  if (!match) {
    return {
      configText: null,
      cleanedContent: content.trim(),
    }
  }

  // Gemini may wrap JSON in code fences inside the CONFIG tag
  let configText = match[1]?.trim() ?? null
  if (configText) {
    configText = configText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
  }

  return {
    configText,
    cleanedContent: content.replace(match[0], '').trim(),
  }
}

/**
 * Normalizes AI-generated config values before schema validation.
 * Rounds all amounts to integers since Gemini may return floats.
 */
function normalizeConfigData(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const obj = { ...(raw as Record<string, unknown>) }

  if (typeof obj.monthly_income === 'number') {
    obj.monthly_income = Math.round(obj.monthly_income)
  }
  if (typeof obj.monthly_savings_target === 'number') {
    obj.monthly_savings_target = Math.round(obj.monthly_savings_target)
  }

  if (Array.isArray(obj.life_goals)) {
    obj.life_goals = obj.life_goals.map((goal: unknown) => {
      if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return goal
      const g = { ...(goal as Record<string, unknown>) }
      if (typeof g.target_amount === 'number') g.target_amount = Math.round(g.target_amount)
      if (typeof g.monthly_saving === 'number') g.monthly_saving = Math.round(g.monthly_saving)
      if (typeof g.target_year === 'number') g.target_year = Math.round(g.target_year)
      return g
    })
  }

  if (obj.suggested_budgets && typeof obj.suggested_budgets === 'object' && !Array.isArray(obj.suggested_budgets)) {
    obj.suggested_budgets = Object.fromEntries(
      Object.entries(obj.suggested_budgets as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === 'number' ? Math.round(v) : v,
      ]),
    )
  }

  return obj
}

function parseConfig(content: string) {
  try {
    const parsedJson = JSON.parse(content) as unknown
    const normalized = normalizeConfigData(parsedJson)
    const parsed = chatConfigSchema.safeParse(normalized)
    if (!parsed.success) {
      console.warn('[chat] CONFIG validation failed:', JSON.stringify(parsed.error.issues))
    }
    return parsed.success ? parsed.data : null
  } catch (err) {
    console.warn('[chat] CONFIG JSON parse error:', err)
    return null
  }
}

/**
 * Parses optional <CONFIG> payload and degrades gracefully when model JSON is invalid.
 */
export async function generateChatResponse(messages: ChatMessage[]): Promise<ChatResponse> {
  const rawContent = await generateGeminiChat({
    systemInstruction: getChatSystemPrompt(),
    history: messages,
  })

  const { configText, cleanedContent } = extractConfigTag(rawContent)
  if (!configText) {
    return {
      role: 'model',
      content: cleanedContent || rawContent.trim(),
      is_complete: false,
      config: null,
    }
  }

  const config = parseConfig(configText)
  if (!config) {
    return {
      role: 'model',
      content: cleanedContent || '設定内容をもう一度確認させてください。',
      is_complete: false,
      config: null,
    }
  }

  return {
    role: 'model',
    content: cleanedContent || '設定内容をまとめました。問題なければ保存してください。',
    is_complete: true,
    config,
  }
}

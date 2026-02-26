import type { ChatMessage, ChatResponse } from '@lifebalance/shared/types'

import { extractFirstJsonObject, generateGeminiChat, generateGeminiText } from './gemini'
import { getChatSystemPrompt } from './prompts/chat'
import { chatConfigSchema } from '../schemas/chat'

// Phrases that indicate the AI has finished collecting all required info
const COMPLETION_INDICATORS = [
  '設定は完了',
  '設定が完了',
  '設定完了',
  '完了です',
  '完了しました',
  '保存してください',
  '設定内容をまとめました',
  '同意いただけた',
  'ご同意いただき',
]

function isCompletionResponse(content: string): boolean {
  return COMPLETION_INDICATORS.some((phrase) => content.includes(phrase))
}

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
 * When the chat AI indicates completion but doesn't output a <CONFIG> tag,
 * make a separate extraction-only call to Gemini to get the structured JSON.
 */
async function extractConfigFromHistory(messages: ChatMessage[]) {
  const currentYear = new Date().getUTCFullYear()
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`)
    .join('\n')

  const prompt = `
以下の会話から家計設定情報を抽出し、JSONのみを返してください（説明文は不要）。

--- 会話 ---
${conversationText}
--- ここまで ---

以下の形式でJSONを返してください。キーの変更は禁止です：
{
  "monthly_income": <月収（整数・円）>,
  "monthly_savings_target": <月々の貯蓄目標額（整数・円）>,
  "life_goals": [
    {
      "title": "<ライフイベント名>",
      "icon": "<絵文字1文字>",
      "target_amount": <目標金額（整数・円）>,
      "monthly_saving": <月々の積立額（整数・円）>,
      "target_year": <目標年（${currentYear}以降の整数）>,
      "priority": "高"
    }
  ],
  "suggested_budgets": {
    "housing": <家賃・住居費（整数・円）>,
    "food": <食費（整数・円）>,
    "transport": <交通費（整数・円）>,
    "entertainment": <娯楽費（整数・円）>,
    "clothing": <衣服費（整数・円）>,
    "communication": <通信費（整数・円）>,
    "medical": <医療費（整数・円）>,
    "social": <交際費（整数・円）>,
    "other": <その他（整数・円）>
  }
}
`.trim()

  try {
    const rawJson = await generateGeminiText({ prompt })
    const jsonStr = extractFirstJsonObject(rawJson)
    if (!jsonStr) {
      console.warn('[chat] extraction: no JSON object found in response')
      return null
    }
    return parseConfig(jsonStr)
  } catch (err) {
    console.warn('[chat] extraction call failed:', err)
    return null
  }
}

/**
 * Parses optional <CONFIG> payload and degrades gracefully when model JSON is invalid.
 * Falls back to a dedicated extraction call when the AI indicates completion without a CONFIG tag.
 */
export async function generateChatResponse(messages: ChatMessage[]): Promise<ChatResponse> {
  const rawContent = await generateGeminiChat({
    systemInstruction: getChatSystemPrompt(),
    history: messages,
  })

  const { configText, cleanedContent } = extractConfigTag(rawContent)

  // Path 1: AI included <CONFIG> tag — parse and validate directly
  if (configText) {
    const config = parseConfig(configText)
    if (config) {
      return {
        role: 'model',
        content: cleanedContent || '設定内容をまとめました。問題なければ保存してください。',
        is_complete: true,
        config,
      }
    }
    // CONFIG tag found but JSON was invalid — fall through to extraction
    console.warn('[chat] CONFIG tag present but JSON invalid, attempting extraction fallback')
  }

  // Path 2: No valid CONFIG tag, but AI signals completion — extract via dedicated call
  if (isCompletionResponse(cleanedContent || rawContent)) {
    console.info('[chat] Completion detected, attempting config extraction from history')
    const config = await extractConfigFromHistory(messages)
    if (config) {
      return {
        role: 'model',
        content: cleanedContent || rawContent.trim(),
        is_complete: true,
        config,
      }
    }
    console.warn('[chat] Extraction fallback also failed')
  }

  // Path 3: Still in conversation
  return {
    role: 'model',
    content: cleanedContent || rawContent.trim(),
    is_complete: false,
    config: null,
  }
}

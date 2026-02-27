import { z } from 'zod'

import { chatConfigSchema } from '../schemas/chat'
import { ocrSuccessResponseSchema } from '../schemas/ocr'
import { extractFirstJsonObject } from '../services/gemini'

const adviceSchema = z.object({
  score: z.number().int().min(0).max(100),
  urgent: z.array(z.object({ title: z.string(), body: z.string() })),
  suggestions: z.array(z.object({ title: z.string(), body: z.string() })),
  positives: z.array(z.object({ title: z.string(), body: z.string() })),
  next_month_goals: z.array(z.string()),
})

const lineExtractionSchema = z.object({
  amount: z.number().int().min(1),
  category: z.string().min(1),
  description: z.string().nullable().optional(),
  transacted_at: z.string().nullable().optional(),
})

function evaluateJsonOutput<T extends z.ZodTypeAny>(name: string, schema: T, output: string) {
  const jsonText = extractFirstJsonObject(output)
  if (!jsonText) {
    return {
      name,
      ok: false,
      reason: 'JSON block not found',
    }
  }

  try {
    const parsed = schema.safeParse(JSON.parse(jsonText))
    if (!parsed.success) {
      return {
        name,
        ok: false,
        reason: parsed.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    return {
      name,
      ok: true,
      reason: 'OK',
    }
  } catch (error) {
    return {
      name,
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown parse error',
    }
  }
}

const cases = [
  evaluateJsonOutput(
    'OCR',
    ocrSuccessResponseSchema,
    `{
      "amount": 980,
      "description": "ラーメン一蘭 新宿店",
      "transacted_at": "2025-06-29",
      "category": "food",
      "confidence": 0.95
    }`,
  ),
  evaluateJsonOutput(
    'Advice',
    adviceSchema,
    `\`\`\`json
    {
      "score": 72,
      "urgent": [{"title":"食費が高い","body":"今週は外食を減らしましょう"}],
      "suggestions": [{"title":"サブスク整理","body":"使っていない契約を停止する"}],
      "positives": [{"title":"貯蓄継続","body":"6ヶ月連続で達成しています"}],
      "next_month_goals": ["食費を3万円以内にする", "固定費を見直す"]
    }
    \`\`\``,
  ),
  evaluateJsonOutput(
    'ChatConfig',
    chatConfigSchema,
    `{
      "monthly_income": 280000,
      "monthly_savings_target": 60000,
      "current_savings": 1200000,
      "life_goals": [
        {
          "title": "マイホーム購入",
          "target_amount": 5000000,
          "target_year": 2028,
          "priority": "高"
        },
        {
          "title": "留学",
          "target_amount": "unknown",
          "target_year": "unknown",
          "priority": "unknown"
        }
      ],
      "suggested_budgets": {
        "housing": 75000,
        "food": 30000
      }
    }`,
  ),
  evaluateJsonOutput(
    'LINE Text',
    lineExtractionSchema,
    `{
      "amount": 1200,
      "category": "transport",
      "description": "交通費",
      "transacted_at": "2025-06-29"
    }`,
  ),
]

const passed = cases.filter((item) => item.ok).length
console.log(`Prompt evaluation: ${passed}/${cases.length} passed`)
for (const item of cases) {
  console.log(`- [${item.ok ? 'OK' : 'NG'}] ${item.name}: ${item.reason}`)
}

import { GoogleGenerativeAI } from '@google/generative-ai'

import { env } from '../lib/env'
import { AppError } from '../lib/errors'

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const MAX_RETRIES = 2
const BASE_RETRY_DELAY_MS = 400

let genAI: GoogleGenerativeAI | null = null

function getClient() {
  if (!env.GEMINI_API_KEY) {
    throw new AppError('INTERNAL_ERROR', 'GEMINI_API_KEY is not configured')
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  }

  return genAI
}

function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const maybeStatus = (error as { status?: number }).status
  if (typeof maybeStatus === 'number') {
    return maybeStatus === 408 || maybeStatus === 429 || maybeStatus >= 500
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('429') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('rate limit') ||
    message.includes('overloaded')
  )
}

async function sleep(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function withRetry<T>(operation: () => Promise<T>) {
  let attempt = 0

  for (;;) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isRetryableError(error)) {
        throw error
      }

      const delayMs = BASE_RETRY_DELAY_MS * 2 ** attempt
      attempt += 1
      await sleep(delayMs)
    }
  }
}

export async function generateGeminiText(params: {
  prompt: string
  systemInstruction?: string
}) {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: params.systemInstruction,
  })

  return withRetry(async () => {
    const response = await model.generateContent(params.prompt)
    return response.response.text()
  })
}

export async function generateGeminiVisionText(params: {
  prompt: string
  imageBase64: string
  mimeType: string
  systemInstruction?: string
}) {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: params.systemInstruction,
  })

  return withRetry(async () => {
    const response = await model.generateContent([
      params.prompt,
      {
        inlineData: {
          data: params.imageBase64,
          mimeType: params.mimeType,
        },
      },
    ])
    return response.response.text()
  })
}

export async function generateGeminiChat(params: {
  systemInstruction: string
  history: Array<{ role: 'user' | 'model'; content: string }>
}) {
  const latestUserIndex = [...params.history]
    .reverse()
    .findIndex((item) => item.role === 'user')

  const normalizedLatestUserIndex =
    latestUserIndex === -1 ? -1 : params.history.length - 1 - latestUserIndex
  const latestUserMessage =
    normalizedLatestUserIndex >= 0 ? params.history[normalizedLatestUserIndex]?.content : null

  const historyForModel =
    normalizedLatestUserIndex >= 0
      ? params.history.slice(0, normalizedLatestUserIndex)
      : params.history
  const sanitizedHistory = [...historyForModel]
  while (sanitizedHistory[0]?.role === 'model') {
    sanitizedHistory.shift()
  }

  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: params.systemInstruction,
  })

  const chat = model.startChat({
    history: sanitizedHistory.map((item) => ({
      role: item.role,
      parts: [{ text: item.content }],
    })),
  })

  return withRetry(async () => {
    const response = await chat.sendMessage(latestUserMessage ?? '会話を続けてください。')
    return response.response.text()
  })
}

/**
 * Gemini returns JSON with code fences or surrounding explanation in some cases.
 * This helper extracts the first JSON object block defensively.
 */
export function extractFirstJsonObject(text: string) {
  const normalized = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const start = normalized.indexOf('{')

  if (start === -1) {
    return null
  }

  let depth = 0
  for (let i = start; i < normalized.length; i += 1) {
    const char = normalized[i]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return normalized.slice(start, i + 1)
      }
    }
  }

  return null
}

if (import.meta.main) {
  generateGeminiText({
    prompt: '短い日本語で挨拶してください。出力は1文のみ。',
  })
    .then((text) => {
      console.log(text)
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}

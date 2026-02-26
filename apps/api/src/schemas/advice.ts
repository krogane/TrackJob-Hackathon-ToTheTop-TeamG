import { z } from 'zod'

import { yearMonthSchema } from './common'

export const getAdviceQuerySchema = z.object({
  month: yearMonthSchema.optional(),
})

export const generateAdviceBodySchema = z.object({
  month: yearMonthSchema.optional(),
  force: z.boolean().optional(),
})

export const adviceHistoryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
})

export const adviceQuestionBodySchema = z.object({
  question: z.string().min(1).max(500),
})

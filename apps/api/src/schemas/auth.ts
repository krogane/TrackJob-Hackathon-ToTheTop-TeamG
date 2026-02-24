import { z } from 'zod'

import { isoDatetimeSchema, uuidSchema } from './common'

export const createProfileBodySchema = z.object({
  display_name: z.string().min(1).max(50),
  monthly_income: z.number().int().min(0).optional().default(0),
})

export const updateProfileBodySchema = z
  .object({
    display_name: z.string().min(1).max(50).optional(),
    monthly_income: z.number().int().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'at least one field is required')

export const profileResponseSchema = z.object({
  id: uuidSchema,
  display_name: z.string(),
  monthly_income: z.number().int(),
  created_at: isoDatetimeSchema,
  updated_at: isoDatetimeSchema.optional(),
})

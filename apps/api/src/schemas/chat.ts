import { z } from 'zod'

import { GOAL_PRIORITIES } from './constants'

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string().min(1).max(2000),
})

export const chatSetupContextSchema = z
  .object({
    monthly_income: z.number().int().min(0).optional(),
    current_savings: z.number().int().min(0).optional(),
    housing_cost: z.number().int().min(0).optional(),
    daily_food_cost: z.number().int().min(0).optional(),
  })
  .optional()

export const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  setup_context: chatSetupContextSchema,
})

const chatGoalSchema = z.object({
  title: z.string().min(1).max(50),
  target_amount: z.union([z.number().int().min(1), z.literal('unknown')]),
  target_year: z.union([
    z.number().int().min(new Date().getUTCFullYear()),
    z.literal('unknown'),
  ]),
  priority: z.union([z.enum(GOAL_PRIORITIES), z.literal('unknown')]),
})

export const chatExtractedConfigSchema = z.object({
  monthly_savings_target: z.number().int().min(0),
  life_goals: z.array(chatGoalSchema).min(1),
})

export const chatConfigSchema = z.object({
  monthly_income: z.number().int().min(0).default(0),
  monthly_savings_target: chatExtractedConfigSchema.shape.monthly_savings_target,
  current_savings: z.number().int().min(0).optional(),
  life_goals: chatExtractedConfigSchema.shape.life_goals,
  suggested_budgets: z.record(z.number().int().min(0)).default({}),
})

export const chatResponseSchema = z.object({
  role: z.literal('model'),
  content: z.string(),
  is_complete: z.boolean(),
  config: chatConfigSchema.nullable(),
})

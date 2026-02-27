import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  monthlyIncome: integer('monthly_income').notNull(),
  notificationReminder: boolean('notification_reminder').notNull().default(true),
  notificationWeekly: boolean('notification_weekly').notNull().default(true),
  notificationMonthly: boolean('notification_monthly').notNull().default(true),
  notificationLine: boolean('notification_line').notNull().default(true),
  notificationDiscord: boolean('notification_discord').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    type: text('type').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    receiptUrl: text('receipt_url'),
    source: text('source').notNull().default('dashboard'),
    transactedAt: date('transacted_at').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTransactedAtIdx: index('transactions_user_id_transacted_at_idx').on(
      table.userId,
      table.transactedAt,
    ),
  }),
)

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    category: text('category').notNull(),
    limitAmount: integer('limit_amount').notNull(),
    isFixed: boolean('is_fixed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userYearMonthIdx: index('budgets_user_id_year_month_idx').on(table.userId, table.yearMonth),
    userYearMonthCategoryUnique: unique('budgets_user_id_year_month_category_unique').on(
      table.userId,
      table.yearMonth,
      table.category,
    ),
  }),
)

export const lifeGoals = pgTable('life_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  icon: text('icon').notNull().default('🎯'),
  targetAmount: integer('target_amount').notNull(),
  savedAmount: integer('saved_amount').notNull().default(0),
  monthlySaving: integer('monthly_saving').notNull(),
  targetYear: integer('target_year').notNull(),
  priority: text('priority').notNull(),
  status: text('status').notNull().default('active'),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assumptions = pgTable('assumptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  age: integer('age').notNull(),
  annualIncomeGrowth: numeric('annual_income_growth', {
    precision: 5,
    scale: 2,
    mode: 'number',
  }).notNull(),
  investmentReturn: numeric('investment_return', {
    precision: 5,
    scale: 2,
    mode: 'number',
  }).notNull(),
  inflationRate: numeric('inflation_rate', {
    precision: 5,
    scale: 2,
    mode: 'number',
  }).notNull(),
  monthlyInvestment: integer('monthly_investment').notNull(),
  simulationTrials: integer('simulation_trials').notNull().default(1000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const adviceLogs = pgTable(
  'advice_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: varchar('month', { length: 7 }).notNull(),
    content: jsonb('content').notNull(),
    score: integer('score').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userMonthUnique: unique('advice_logs_user_id_month_unique').on(table.userId, table.month),
  }),
)

export const externalConnections = pgTable(
  'external_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    platformUserId: text('platform_user_id').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userPlatformUnique: unique('external_connections_user_id_platform_unique').on(
      table.userId,
      table.platform,
    ),
  }),
)

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ZodError } from 'zod'

import { env } from './lib/env'
import { isAppError } from './lib/errors'
import { errorResponse } from './lib/response'
import { formatZodError } from './lib/validation'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import type { AppBindings } from './types'
import authRoute from './routes/auth'
import transactionsRoute from './routes/transactions'
import budgetsRoute from './routes/budgets'
import goalsRoute from './routes/goals'
import assumptionsRoute from './routes/assumptions'
import connectionsRoute from './routes/connections'
import simulationRoute from './routes/simulation'
import adviceRoute from './routes/advice'
import ocrRoute from './routes/ocr'
import chatRoute from './routes/chat'
import lineWebhookRoute from './routes/webhooks/line'
import { startDiscordGateway } from './services/discord'
import { sendDailyReminder, sendMonthlySummary, sendWeeklySummary } from './services/notifications'
import { startScheduler } from './lib/scheduler'

const app = new Hono<AppBindings>()

app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.use('/api/*', rateLimitMiddleware)

app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/webhooks/')) {
    await next()
    return
  }

  await authMiddleware(c, next)
})

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', authRoute)
app.route('/api/transactions', transactionsRoute)
app.route('/api/budgets', budgetsRoute)
app.route('/api/goals', goalsRoute)
app.route('/api/assumptions', assumptionsRoute)
app.route('/api/connections', connectionsRoute)
app.route('/api/simulation', simulationRoute)
app.route('/api/advice', adviceRoute)
app.route('/api/ocr', ocrRoute)
app.route('/api/chat', chatRoute)
app.route('/api/webhooks/line', lineWebhookRoute)

app.notFound((c) => errorResponse(c, 'NOT_FOUND', 'Route not found', 404))

app.onError((error, c) => {
  if (isAppError(error)) {
    return errorResponse(c, error.code, error.message, error.status)
  }

  if (error instanceof ZodError) {
    return errorResponse(c, 'VALIDATION_ERROR', formatZodError(error), 400)
  }

  console.error(error)
  return errorResponse(c, 'INTERNAL_ERROR', 'Server error', 500)
})

startDiscordGateway().catch(console.error)

startScheduler({
  onDailyReminder: sendDailyReminder,
  onWeeklySummary: sendWeeklySummary,
  onMonthlySummary: sendMonthlySummary,
})

export default {
  port: env.PORT,
  fetch: app.fetch,
}

export { app }

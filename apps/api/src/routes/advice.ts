import { Hono } from 'hono'

import { parseJsonBody, parseOptionalJsonBody, parseQuery } from '../lib/request'
import { success } from '../lib/response'
import type { AppBindings } from '../types'
import { adviceHistoryQuerySchema, adviceQuestionBodySchema, generateAdviceBodySchema, getAdviceQuerySchema } from '../schemas/advice'
import { answerAdviceQuestion, findAdviceCache, generateAdvice, getAdviceHistory } from '../services/advice'
import { AppError } from '../lib/errors'

const adviceRoute = new Hono<AppBindings>()

adviceRoute.get('/', async (c) => {
  const query = parseQuery(c, getAdviceQuerySchema)
  const userId = c.get('userId')
  const targetMonth = query.month ?? new Date().toISOString().slice(0, 7)

  const advice = await findAdviceCache(userId, targetMonth)

  if (!advice) {
    throw new AppError('NOT_FOUND', `Advice for ${targetMonth} has not been generated yet`)
  }

  return success(c, advice)
})

adviceRoute.get('/history', async (c) => {
  const query = parseQuery(c, adviceHistoryQuerySchema)
  const userId = c.get('userId')

  const history = await getAdviceHistory(userId, query.months)
  return success(c, history)
})

adviceRoute.post('/question', async (c) => {
  const body = await parseJsonBody(c, adviceQuestionBodySchema)
  const answer = await answerAdviceQuestion(body.question)
  return success(c, { answer })
})

adviceRoute.post('/generate', async (c) => {
  const body = await parseOptionalJsonBody(c, generateAdviceBodySchema)
  const userId = c.get('userId')
  const targetMonth = body.month ?? new Date().toISOString().slice(0, 7)

  const data = await generateAdvice({
    userId,
    month: targetMonth,
    force: body.force ?? false,
  })

  return success(c, data, 201)
})

export default adviceRoute

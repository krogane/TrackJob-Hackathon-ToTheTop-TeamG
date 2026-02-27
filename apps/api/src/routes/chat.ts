import { Hono } from 'hono'

import { parseJsonBody } from '../lib/request'
import { success } from '../lib/response'
import { chatBodySchema } from '../schemas/chat'
import { generateChatResponse } from '../services/chat'
import type { AppBindings } from '../types'

const chatRoute = new Hono<AppBindings>()

chatRoute.post('/', async (c) => {
  const body = await parseJsonBody(c, chatBodySchema)
  const data = await generateChatResponse(body.messages, body.setup_context ?? null)
  return success(c, data)
})

export default chatRoute

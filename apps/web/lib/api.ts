import type {
  AdviceHistoryItem,
  AdviceLog,
  ApiErrorResponse,
  Assumption,
  Budget,
  BudgetSummary,
  ChatMessage,
  ChatResponse,
  ExpenseCategory,
  ExternalConnection,
  Goal,
  SimulationResult,
  Transaction,
  TransactionCategory,
  TransactionSummary,
  TransactionType,
  UserProfile,
} from '@lifebalance/shared/types'

import { getSupabaseBrowserClient } from '@/lib/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8787'

export interface Pagination {
  total: number
  page: number
  limit: number
  has_next: boolean
}

interface ApiSuccessEnvelope<T> {
  data: T
  pagination?: Pagination
}

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function isFormDataBody(body: RequestInit['body']) {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

async function createAuthHeaders(body: RequestInit['body']) {
  const headers: Record<string, string> = {}

  if (!isFormDataBody(body)) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // noop
  }

  return headers
}

function createQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }
    searchParams.set(key, String(value))
  }

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export async function apiRequestEnvelope<T>(path: string, init?: RequestInit): Promise<ApiSuccessEnvelope<T>> {
  const authHeaders = await createAuthHeaders(init?.body)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => null)) as ApiErrorResponse | null
    throw new ApiError(
      errorJson?.error.message ?? 'API request failed',
      errorJson?.error.code ?? 'INTERNAL_ERROR',
      response.status,
    )
  }

  if (response.status === 204) {
    return { data: undefined as T }
  }

  return (await response.json()) as ApiSuccessEnvelope<T>
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const envelope = await apiRequestEnvelope<T>(path, init)
  return envelope.data
}

export const authProfileApi = {
  create: (body: { display_name: string; monthly_income?: number }) =>
    apiRequest<UserProfile>('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  get: () => apiRequest<UserProfile>('/api/auth/profile'),
  update: (body: Partial<Pick<UserProfile, 'display_name' | 'monthly_income'>>) =>
    apiRequest<UserProfile>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
}

export interface ListTransactionsParams {
  year_month?: string
  category?: TransactionCategory
  type?: TransactionType
  source?: 'dashboard' | 'line' | 'discord'
  keyword?: string
  page?: number
  limit?: number
  sort?: 'transacted_at' | 'amount' | 'created_at'
  order?: 'asc' | 'desc'
}

export interface CreateTransactionBody {
  amount: number
  type: TransactionType
  category: TransactionCategory
  description?: string
  receipt_url?: string | null
  transacted_at: string
}

export interface UpdateTransactionBody {
  amount?: number
  type?: TransactionType
  category?: TransactionCategory
  description?: string
  receipt_url?: string | null
  source?: 'dashboard' | 'line' | 'discord'
  transacted_at?: string
}

export const transactionsApi = {
  list: (params: ListTransactionsParams = {}) =>
    apiRequestEnvelope<Transaction[]>(
      `/api/transactions${createQueryString({
        year_month: params.year_month,
        category: params.category,
        type: params.type,
        source: params.source,
        keyword: params.keyword,
        page: params.page,
        limit: params.limit,
        sort: params.sort,
        order: params.order,
      })}`,
    ),
  create: (body: CreateTransactionBody) =>
    apiRequest<Transaction>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patch: (id: string, body: UpdateTransactionBody) =>
    apiRequest<Transaction>(`/api/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiRequest<void>(`/api/transactions/${id}`, {
      method: 'DELETE',
    }),
  summary: (yearMonth?: string) =>
    apiRequest<TransactionSummary>(
      `/api/transactions/summary${createQueryString({
        year_month: yearMonth,
      })}`,
    ),
  streak: () => apiRequest<{ streak_days: number }>('/api/transactions/streak'),
  trend: (range: '1m' | '3m' | '1y') =>
    apiRequest<Array<{ label: string; expense: number; saving: number }>>(
      `/api/transactions/trend${createQueryString({ range })}`,
    ),
  uploadReceipt: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiRequest<{ url: string }>('/api/transactions/upload-receipt', {
      method: 'POST',
      body: formData,
    })
  },
}

export const budgetsApi = {
  get: (yearMonth?: string) =>
    apiRequest<BudgetSummary>(`/api/budgets${createQueryString({ year_month: yearMonth })}`),
  streak: () => apiRequest<{ streak_months: number }>('/api/budgets/streak'),
  updateBulk: (body: {
    year_month: string
    budgets: Array<{
      category: ExpenseCategory
      limit_amount: number
      is_fixed: boolean
    }>
  }) =>
    apiRequest<{ year_month: string; updated_count: number }>('/api/budgets', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  patch: (id: string, body: { limit_amount?: number; is_fixed?: boolean }) =>
    apiRequest<Budget>(`/api/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
}

export const goalsApi = {
  list: (status?: 'active' | 'paused' | 'completed') =>
    apiRequest<Goal[]>(`/api/goals${createQueryString({ status })}`),
  create: (body: {
    title: string
    icon?: string
    target_amount: number
    saved_amount?: number
    monthly_saving: number
    target_year: number
    priority: '高' | '中' | '低'
  }) =>
    apiRequest<Goal>('/api/goals', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patch: (
    id: string,
    body: {
      title?: string
      icon?: string
      target_amount?: number
      saved_amount?: number
      monthly_saving?: number
      target_year?: number
      priority?: '高' | '中' | '低'
      status?: 'active' | 'paused' | 'completed'
    },
  ) =>
    apiRequest<Goal>(`/api/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiRequest<void>(`/api/goals/${id}`, {
      method: 'DELETE',
    }),
}

export const assumptionsApi = {
  get: () => apiRequest<Assumption>('/api/assumptions'),
  update: (body: Omit<Assumption, 'id' | 'updated_at'> & { simulation_trials?: 100 | 500 | 1000 }) =>
    apiRequest<Assumption>('/api/assumptions', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}

export const simulationApi = {
  run: (force = false) =>
    apiRequest<SimulationResult>('/api/simulation/run', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),
  scenario: (overrides: Partial<Omit<Assumption, 'id' | 'updated_at'>>) =>
    apiRequest<SimulationResult>('/api/simulation/scenario', {
      method: 'POST',
      body: JSON.stringify({ overrides }),
    }),
}

export const ocrApi = {
  parse: (body: { image_url: string }) =>
    apiRequest<{
      amount: number | null
      description: string | null
      transacted_at: string | null
      category: string | null
      confidence: number
      error_message?: string
    }>('/api/ocr', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export const adviceApi = {
  get: (month?: string) =>
    apiRequest<AdviceLog>(`/api/advice${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  history: (months = 6) =>
    apiRequest<AdviceHistoryItem[]>(`/api/advice/history?months=${encodeURIComponent(String(months))}`),
  generate: (body?: { month?: string; force?: boolean }) =>
    apiRequest<AdviceLog>('/api/advice/generate', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
}

export const chatApi = {
  send: (messages: ChatMessage[]) =>
    apiRequest<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
}

export const connectionsApi = {
  list: () => apiRequest<ExternalConnection[]>('/api/connections'),
  connectLine: (lineUserId: string) =>
    apiRequest<ExternalConnection>('/api/connections/line', {
      method: 'POST',
      body: JSON.stringify({ line_user_id: lineUserId }),
    }),
  connectDiscord: (code: string, redirectUri: string) =>
    apiRequest<ExternalConnection>('/api/connections/discord', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),
  disconnect: (platform: 'line' | 'discord') =>
    apiRequest<void>(`/api/connections/${platform}`, {
      method: 'DELETE',
    }),
}

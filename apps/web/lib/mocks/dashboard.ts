import type { AdviceLog, Goal, Transaction } from '@lifebalance/shared/types'

export const dashboardSummary = {
  expense: { value: 143200, budget: 180000, changeLabel: '先月比 +¥8,300', trend: 'down' as const },
  saving: { value: 56800, target: 60000, changeLabel: '目標達成率 94.7%', trend: 'up' as const },
  assets: { value: 3840000, target: 50000000, changeLabel: '前月比 +¥68,000', trend: 'up' as const },
}

export const trendSeries = {
  '3m': [
    { month: '4月', expense: 132000, saving: 52000, budget: 180000 },
    { month: '5月', expense: 134900, saving: 55100, budget: 180000 },
    { month: '6月', expense: 143200, saving: 56800, budget: 180000 },
  ],
  '6m': [
    { month: '1月', expense: 148000, saving: 42000, budget: 180000 },
    { month: '2月', expense: 140000, saving: 46000, budget: 180000 },
    { month: '3月', expense: 136000, saving: 50000, budget: 180000 },
    { month: '4月', expense: 132000, saving: 52000, budget: 180000 },
    { month: '5月', expense: 134900, saving: 55100, budget: 180000 },
    { month: '6月', expense: 143200, saving: 56800, budget: 180000 },
  ],
  '1y': [
    { month: '7月', expense: 151000, saving: 39000, budget: 180000 },
    { month: '8月', expense: 149000, saving: 41000, budget: 180000 },
    { month: '9月', expense: 154000, saving: 36000, budget: 180000 },
    { month: '10月', expense: 145000, saving: 45000, budget: 180000 },
    { month: '11月', expense: 141000, saving: 47000, budget: 180000 },
    { month: '12月', expense: 139000, saving: 49000, budget: 180000 },
    { month: '1月', expense: 148000, saving: 42000, budget: 180000 },
    { month: '2月', expense: 140000, saving: 46000, budget: 180000 },
    { month: '3月', expense: 136000, saving: 50000, budget: 180000 },
    { month: '4月', expense: 132000, saving: 52000, budget: 180000 },
    { month: '5月', expense: 134900, saving: 55100, budget: 180000 },
    { month: '6月', expense: 143200, saving: 56800, budget: 180000 },
  ],
}

export const recentTransactions: Transaction[] = [
  {
    id: 'tx-1',
    category: 'food',
    type: 'expense',
    amount: 980,
    description: 'ラーメン一蘭',
    transacted_at: '2025-06-29',
    source: 'dashboard',
    created_at: '2025-06-29T12:00:00Z',
    updated_at: '2025-06-29T12:00:00Z',
  },
  {
    id: 'tx-2',
    category: 'transport',
    type: 'expense',
    amount: 3000,
    description: 'Suica チャージ',
    transacted_at: '2025-06-28',
    source: 'dashboard',
    created_at: '2025-06-28T12:00:00Z',
    updated_at: '2025-06-28T12:00:00Z',
  },
  {
    id: 'tx-3',
    category: 'salary',
    type: 'income',
    amount: 280000,
    description: '給与振込',
    transacted_at: '2025-06-25',
    source: 'dashboard',
    created_at: '2025-06-25T12:00:00Z',
    updated_at: '2025-06-25T12:00:00Z',
  },
  {
    id: 'tx-4',
    category: 'housing',
    type: 'expense',
    amount: 75000,
    description: '家賃',
    transacted_at: '2025-06-01',
    source: 'dashboard',
    created_at: '2025-06-01T12:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
  },
  {
    id: 'tx-5',
    category: 'communication',
    type: 'expense',
    amount: 1078,
    description: '楽天モバイル',
    transacted_at: '2025-06-03',
    source: 'dashboard',
    created_at: '2025-06-03T12:00:00Z',
    updated_at: '2025-06-03T12:00:00Z',
  },
]

export const lifeGoals: Goal[] = [
  {
    id: 'goal-1',
    title: 'マイホーム購入',
    icon: '🏠',
    target_amount: 5000000,
    saved_amount: 3840000,
    monthly_saving: 30000,
    target_year: 2028,
    priority: '高',
    status: 'active',
    sort_order: 1,
    progress_rate: 0.768,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-29T00:00:00Z',
  },
  {
    id: 'goal-2',
    title: '第一子誕生準備',
    icon: '👶',
    target_amount: 1000000,
    saved_amount: 420000,
    monthly_saving: 23000,
    target_year: 2026,
    priority: '中',
    status: 'active',
    sort_order: 2,
    progress_rate: 0.42,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-29T00:00:00Z',
  },
  {
    id: 'goal-3',
    title: 'FIRE達成',
    icon: '🏖️',
    target_amount: 50000000,
    saved_amount: 3840000,
    monthly_saving: 60000,
    target_year: 2045,
    priority: '低',
    status: 'active',
    sort_order: 3,
    progress_rate: 0.0768,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-29T00:00:00Z',
  },
]

export const advicePreview: AdviceLog = {
  id: 'advice-2025-06',
  month: '2025-06',
  score: 72,
  generated_at: '2025-06-29T12:00:00Z',
  content: {
    urgent: [
      {
        title: '食費が予算の92%に達しています',
        body: '残り7日で¥2,800の余裕しかありません。自炊比率を上げると改善できます。',
      },
    ],
    suggestions: [
      {
        title: 'サブスク見直しで月¥3,400節約できます',
        body: '利用頻度の低いサービスを一時停止して固定費を抑えましょう。',
      },
    ],
    positives: [
      {
        title: '貯蓄習慣が定着しています',
        body: '過去6ヶ月連続で目標の90%以上を達成しています。',
      },
    ],
    next_month_goals: ['食費を¥27,000以内', '育児積立を¥23,000', '動画サブスク利用見直し'],
  },
}

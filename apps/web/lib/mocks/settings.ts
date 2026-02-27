import type { ExternalConnection, UserProfile } from '@lifebalance/shared/types'

export const profileMock: UserProfile = {
  id: 'user-1',
  display_name: '田中 太郎',
  monthly_income: 280000,
  notification_reminder: true,
  notification_weekly: true,
  notification_monthly: true,
  notification_line: true,
  notification_discord: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-29T00:00:00Z',
}

export const connectionsMock: ExternalConnection[] = [
  {
    id: 'conn-1',
    platform: 'line',
    is_active: true,
    connected_at: '2025-06-01T00:00:00Z',
    external_user_id: 'U1234567890',
    created_at: '2025-06-01T00:00:00Z',
  },
]

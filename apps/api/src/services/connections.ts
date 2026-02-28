import {
  deleteConnection,
  listConnections,
  upsertDiscordConnection,
  upsertLineConnection,
} from '../db/repositories/connections'
import { AppError } from '../lib/errors'
import { env } from '../lib/env'
import { toIsoString } from './serializers'

function mapConnection(row: {
  id: string
  platform: string
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: row.id,
    platform: row.platform,
    is_active: row.isActive,
    connected_at: toIsoString(row.createdAt),
  }
}

export async function listUserConnections(userId: string) {
  const rows = await listConnections(userId)
  return rows.map(mapConnection)
}

export async function connectLine(userId: string, lineUserId: string) {
  const [created] = await upsertLineConnection(userId, lineUserId)
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create connection')
  }
  return mapConnection(created)
}

export async function connectDiscord(userId: string, code: string, redirectUri: string) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new AppError('INTERNAL_ERROR', 'Discord連携が設定されていません')
  }

  // OAuth2 コードをアクセストークンに交換
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => '')
    console.error('[discord-oauth] token exchange failed:', errorText)
    if (tokenResponse.status === 429 || errorText.includes('rate limit')) {
      throw new AppError('VALIDATION_ERROR', 'Discordのサーバーが混雑しています。数分待ってから再度お試しください。')
    }
    throw new AppError('VALIDATION_ERROR', 'Discordの認証コードが無効です。再度連携してください。')
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string }

  // Discord ユーザー情報を取得
  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!userResponse.ok) {
    throw new AppError('INTERNAL_ERROR', 'Discordユーザー情報の取得に失敗しました')
  }

  const discordUser = (await userResponse.json()) as { id: string; username: string }

  const [created] = await upsertDiscordConnection(userId, discordUser.id)
  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create connection')
  }
  return mapConnection(created)
}

export async function disconnectPlatform(userId: string, platform: 'line' | 'discord') {
  await deleteConnection(userId, platform)
}

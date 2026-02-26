'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/useToast'
import { authProfileApi, connectionsApi } from '@/lib/api'

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)
  const [lineConnected, setLineConnected] = useState(false)
  const [lineConnectedAt, setLineConnectedAt] = useState<string | null>(null)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordConnected, setDiscordConnected] = useState(false)
  const [discordConnectedAt, setDiscordConnectedAt] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const lineLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID
  const discordClientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [profile, connections] = await Promise.all([
        authProfileApi.get(),
        connectionsApi.list(),
      ])

      setDisplayName(profile.display_name)
      setMonthlyIncome(profile.monthly_income)

      const lineConnection = connections.find((connection) => connection.platform === 'line' && connection.is_active)
      setLineConnected(Boolean(lineConnection))
      setLineConnectedAt(lineConnection?.connected_at ?? null)

      const discordConnection = connections.find((connection) => connection.platform === 'discord' && connection.is_active)
      setDiscordConnected(Boolean(discordConnection))
      setDiscordConnectedAt(discordConnection?.connected_at ?? null)
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : '設定情報の取得に失敗しました',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const lineStatusText = useMemo(() => {
    if (!lineConnected) return '未連携'
    if (!lineConnectedAt) return 'LINE連携済み'
    return `LINE連携済み（${new Date(lineConnectedAt).toLocaleString('ja-JP')}）`
  }, [lineConnected, lineConnectedAt])

  const discordStatusText = useMemo(() => {
    if (!discordConnected) return '未連携'
    if (!discordConnectedAt) return 'Discord連携済み'
    return `Discord連携済み（${new Date(discordConnectedAt).toLocaleString('ja-JP')}）`
  }, [discordConnected, discordConnectedAt])

  // Discord OAuth2 コールバック処理
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return

    const redirectUri = `${window.location.origin}/settings`
    setDiscordLoading(true)
    connectionsApi.connectDiscord(code, redirectUri)
      .then(() => loadSettings())
      .then(() => {
        toast({ title: 'Discord連携が完了しました', variant: 'success' })
        router.replace('/settings')
      })
      .catch((error) => {
        toast({
          title: error instanceof Error ? error.message : 'Discord連携に失敗しました',
          variant: 'error',
        })
        router.replace('/settings')
      })
      .finally(() => setDiscordLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleProfileSave() {
    try {
      setSavingProfile(true)
      await authProfileApi.update({
        display_name: displayName,
        monthly_income: monthlyIncome,
      })
      toast({ title: 'プロフィールを保存しました', variant: 'success' })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'プロフィール保存に失敗しました',
        variant: 'error',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleLineConnect() {
    if (!lineLiffId) {
      toast({
        title: 'NEXT_PUBLIC_LINE_LIFF_ID が未設定です',
        variant: 'error',
      })
      return
    }

    try {
      setLineLoading(true)
      const liffModule = await import('@line/liff')
      const liff = liffModule.default

      await liff.init({ liffId: lineLiffId })

      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href })
        return
      }

      const profile = await liff.getProfile()
      await connectionsApi.connectLine(profile.userId)
      await loadSettings()
      toast({
        title: 'LINE連携が完了しました',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'LINE連携に失敗しました',
        variant: 'error',
      })
    } finally {
      setLineLoading(false)
    }
  }

  async function handleLineDisconnect() {
    try {
      setLineLoading(true)
      await connectionsApi.disconnect('line')
      await loadSettings()
      toast({
        title: 'LINE連携を解除しました',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'LINE連携解除に失敗しました',
        variant: 'error',
      })
    } finally {
      setLineLoading(false)
    }
  }

  function handleDiscordConnect() {
    if (!discordClientId) {
      toast({ title: 'NEXT_PUBLIC_DISCORD_CLIENT_ID が未設定です', variant: 'error' })
      return
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/settings`)
    const scopes = encodeURIComponent('identify')
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${discordClientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}`
  }

  async function handleDiscordDisconnect() {
    try {
      setDiscordLoading(true)
      await connectionsApi.disconnect('discord')
      await loadSettings()
      toast({ title: 'Discord連携を解除しました', variant: 'success' })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Discord連携解除に失敗しました',
        variant: 'error',
      })
    } finally {
      setDiscordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">設定</h1>
        <p className="text-sm text-text2">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">設定</h1>
        <p className="text-sm text-text2">プロフィール・連携・通知設定を編集できます</p>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">プロフィール設定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-text2">表示名</label>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div>
            <label className="text-xs text-text2">月収</label>
            <Input
              type="number"
              value={monthlyIncome}
              onChange={(event) => setMonthlyIncome(Number(event.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <Button
              className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
              onClick={() => void handleProfileSave()}
              disabled={savingProfile}
            >
              {savingProfile ? '保存中...' : '保存する'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">LINE連携</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">{lineStatusText}</p>
            <p className="text-xs text-text2">LINEから支出登録とサマリー確認ができます</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={lineConnected ? 'success' : 'warning'}>{lineConnected ? 'Connected' : 'Disconnected'}</Badge>
            {lineConnected ? (
              <Button variant="ghost" onClick={() => void handleLineDisconnect()} disabled={lineLoading}>
                {lineLoading ? '解除中...' : '連携解除する'}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => void handleLineConnect()} disabled={lineLoading}>
                {lineLoading ? '連携中...' : 'LINEと連携する'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">Discord連携</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">{discordStatusText}</p>
            <p className="text-xs text-text2">DiscordのDMから支出登録とサマリー確認ができます</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={discordConnected ? 'success' : 'warning'}>{discordConnected ? 'Connected' : 'Disconnected'}</Badge>
            {discordConnected ? (
              <Button variant="ghost" onClick={() => void handleDiscordDisconnect()} disabled={discordLoading}>
                {discordLoading ? '解除中...' : '連携解除する'}
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleDiscordConnect} disabled={discordLoading}>
                {discordLoading ? '連携中...' : 'Discordと連携する'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">通知設定</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm">月次サマリー通知</p>
          <button
            type="button"
            className={`relative h-7 w-14 rounded-full border border-border transition-colors ${notificationEnabled ? 'bg-accent' : 'bg-card2'}`}
            onClick={() => setNotificationEnabled((prev) => !prev)}
            aria-label="月次サマリー通知のON/OFF"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                notificationEnabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

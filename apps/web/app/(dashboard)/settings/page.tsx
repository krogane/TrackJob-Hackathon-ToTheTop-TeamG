'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/useToast'
import { assumptionsApi, authProfileApi, connectionsApi } from '@/lib/api'

type AssumptionsDraft = {
  age: number
  annual_income_growth: number
  investment_return: number
  inflation_rate: number
  monthly_investment: number
  simulation_trials: 100 | 500 | 1000
}

function formatAgeInput(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, '')
  if (!digitsOnly) return ''
  return String(Number(digitsOnly))
}

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [ageInput, setAgeInput] = useState('')
  const [assumptionsDraft, setAssumptionsDraft] = useState<AssumptionsDraft | null>(null)
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true)
  const [monthlyReportEnabled, setMonthlyReportEnabled] = useState(true)
  const [lineNotifEnabled, setLineNotifEnabled] = useState(true)
  const [discordNotifEnabled, setDiscordNotifEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [lineLoading, setLineLoading] = useState(false)
  const [lineConnected, setLineConnected] = useState(false)
  const [lineConnectedAt, setLineConnectedAt] = useState<string | null>(null)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordConnected, setDiscordConnected] = useState(false)
  const [discordConnectedAt, setDiscordConnectedAt] = useState<string | null>(null)
  const [showLineHelp, setShowLineHelp] = useState(false)
  const [showDiscordHelp, setShowDiscordHelp] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const lineLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID
  const lineBotBasicId = process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID
  const discordClientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [profile, connections, assumptions] = await Promise.all([
        authProfileApi.get(),
        connectionsApi.list(),
        assumptionsApi.get(),
      ])

      setDisplayName(profile.display_name)
      setReminderEnabled(profile.notification_reminder ?? true)
      setWeeklyReportEnabled(profile.notification_weekly ?? true)
      setMonthlyReportEnabled(profile.notification_monthly ?? true)
      setLineNotifEnabled(profile.notification_line ?? true)
      setDiscordNotifEnabled(profile.notification_discord ?? true)
      setAssumptionsDraft({
        age: assumptions.age,
        annual_income_growth: assumptions.annual_income_growth,
        investment_return: assumptions.investment_return,
        inflation_rate: assumptions.inflation_rate,
        monthly_investment: assumptions.monthly_investment,
        simulation_trials: assumptions.simulation_trials,
      })
      setAgeInput(String(assumptions.age))

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

  // LINE LIFF コールバック処理（liff.login() によるリダイレクト後に連携を完了させる）
  useEffect(() => {
    const lineConnect = searchParams.get('line_connect')
    if (!lineConnect || !lineLiffId) return

    setLineLoading(true)
    ;(async () => {
      try {
        const liffModule = await import('@line/liff')
        const liff = liffModule.default
        await liff.init({ liffId: lineLiffId })
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          await connectionsApi.connectLine(profile.userId)
          await loadSettings()
          toast({ title: 'LINE連携が完了しました', variant: 'success' })
        }
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : 'LINE連携に失敗しました',
          variant: 'error',
        })
      } finally {
        setLineLoading(false)
        router.replace('/settings')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Discord OAuth2 コールバック処理
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || state !== 'discord') return

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

  async function handleNotifToggle(
    field: 'notification_reminder' | 'notification_weekly' | 'notification_monthly' | 'notification_line' | 'notification_discord',
    setValue: (v: boolean) => void,
    currentValue: boolean,
  ) {
    const newValue = !currentValue
    setValue(newValue)
    try {
      await authProfileApi.update({ [field]: newValue })
    } catch (error) {
      setValue(currentValue)
      toast({ title: error instanceof Error ? error.message : '通知設定の保存に失敗しました', variant: 'error' })
    }
  }

  async function handleProfileSave() {
    if (!assumptionsDraft) {
      toast({
        title: '前提条件の取得に失敗したため、保存できません。',
        variant: 'error',
      })
      return
    }

    try {
      setSavingProfile(true)
      await Promise.all([
        authProfileApi.update({
          display_name: displayName,
        }),
        assumptionsApi.update(assumptionsDraft),
      ])
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
        const redirectUrl = new URL(window.location.href)
        redirectUrl.searchParams.set('line_connect', '1')
        liff.login({ redirectUri: redirectUrl.toString() })
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
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${discordClientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&state=discord`
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

      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-stretch">
        <Card className="h-full bg-card">
          <CardHeader>
            <CardTitle className="text-accent">プロフィール設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-text2">表示名</label>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text2">年齢</label>
              <Input
                className="w-20"
                type="text"
                inputMode="numeric"
                placeholder="例: 30"
                value={ageInput}
                onChange={(event) => {
                  const formatted = formatAgeInput(event.target.value)
                  setAgeInput(formatted)
                  setAssumptionsDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          age: formatted ? Number(formatted) : 0,
                        }
                      : prev,
                  )
                }}
              />
            </div>
            <div className="flex justify-start">
              <Button
                className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
                onClick={() => void handleProfileSave()}
                disabled={savingProfile || !assumptionsDraft}
              >
                {savingProfile ? '保存中...' : '保存する'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col bg-card">
          <CardHeader>
            <CardTitle className="text-accent">家計状況を再設定</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm leading-relaxed text-text2">
              予算や目標などの家計状況を最初から見直したいときは、ここから再設定ができます。
            </p>
            <Button
              className="mt-auto bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
              onClick={() => router.push('/setup?mode=reconfigure')}
            >
              家計状況を再設定する
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">LINE連携</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">{lineStatusText}</p>
            <p className="text-xs text-text2">LINEから支出登録とサマリー確認ができます</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text2">LINE通知</span>
              <button
                type="button"
                className={`relative h-7 w-14 rounded-full transition-colors ${lineNotifEnabled ? 'bg-accent' : 'bg-white/20'}`}
                onClick={() => void handleNotifToggle('notification_line', setLineNotifEnabled, lineNotifEnabled)}
                aria-label="LINE通知のON/OFF"
              >
                <span
                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                    lineNotifEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowLineHelp(true)}>
              使い方
            </Button>
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text2">Discord通知</span>
              <button
                type="button"
                className={`relative h-7 w-14 rounded-full transition-colors ${discordNotifEnabled ? 'bg-accent' : 'bg-white/20'}`}
                onClick={() => void handleNotifToggle('notification_discord', setDiscordNotifEnabled, discordNotifEnabled)}
                aria-label="Discord通知のON/OFF"
              >
                <span
                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                    discordNotifEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowDiscordHelp(true)}>
              使い方
            </Button>
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
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">通知設定</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm">支出リマインド</p>
              <p className="text-xs text-text2">21時までに支出の登録がない日に通知します</p>
            </div>
              <button
                type="button"
                className={`relative h-7 w-14 rounded-full transition-colors ${reminderEnabled ? 'bg-accent' : 'bg-white/20'}`}
                onClick={() => void handleNotifToggle('notification_reminder', setReminderEnabled, reminderEnabled)}
                aria-label="支出リマインドのON/OFF"
              >
                <span
                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                    reminderEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm">週次レポート</p>
              <p className="text-xs text-text2">毎週月曜日に先週の支出レポートを送信します</p>
            </div>
            <button
              type="button"
              className={`relative h-7 w-14 rounded-full transition-colors ${weeklyReportEnabled ? 'bg-accent' : 'bg-white/20'}`}
              onClick={() => void handleNotifToggle('notification_weekly', setWeeklyReportEnabled, weeklyReportEnabled)}
              aria-label="週次レポートのON/OFF"
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                  weeklyReportEnabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm">月次レポート</p>
              <p className="text-xs text-text2">毎月1日に先月の家計サマリーを送信します</p>
            </div>
            <button
              type="button"
              className={`relative h-7 w-14 rounded-full transition-colors ${monthlyReportEnabled ? 'bg-accent' : 'bg-white/20'}`}
              onClick={() => void handleNotifToggle('notification_monthly', setMonthlyReportEnabled, monthlyReportEnabled)}
              aria-label="月次レポートのON/OFF"
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                  monthlyReportEnabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* LINE 使い方ダイアログ */}
      <Dialog open={showLineHelp} onOpenChange={setShowLineHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>LINE連携の使い方</DialogTitle>
            <button
              type="button"
              className="text-text2 hover:text-text"
              onClick={() => setShowLineHelp(false)}
              aria-label="閉じる"
            >
              ✕
            </button>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {lineBotBasicId ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-text2">QRコードを読み取って友だち追加</p>
                <img
                  src={`https://qr-official.line.me/sid/L/${lineBotBasicId?.replace('@', '')}.png`}
                  alt="LINE友だち追加QRコード"
                  className="h-40 w-40 rounded-xl border border-border bg-white p-2"
                />
                <a
                  href={`https://line.me/ti/p/~${lineBotBasicId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-accent underline underline-offset-2"
                >
                  友だち追加リンクを開く
                </a>
              </div>
            ) : (
              <p className="text-center text-sm text-text2">（管理者にQRコードの設定を依頼してください）</p>
            )}
            <div className="space-y-3 rounded-xl border border-border bg-card2 px-4 py-3 text-sm">
              <p className="font-semibold">使い方</p>
              <ol className="space-y-2 text-text2">
                <li>① 上のQRコードでLINE公式アカウントを友だち追加</li>
                <li>② 設定画面の「LINEと連携する」でアカウント連携</li>
                <li>③ 連携後、LINEのトークで以下を送信</li>
              </ol>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">ランチ 850円</td>
                    <td className="py-1.5 text-text2">支出を登録</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">サマリー</td>
                    <td className="py-1.5 text-text2">今月の支出合計を確認</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">ヘルプ</td>
                    <td className="py-1.5 text-text2">使い方一覧を表示</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">レシート画像</td>
                    <td className="py-1.5 text-text2">OCRで自動登録</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Discord 使い方ダイアログ */}
      <Dialog open={showDiscordHelp} onOpenChange={setShowDiscordHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discord連携の使い方</DialogTitle>
            <button
              type="button"
              className="text-text2 hover:text-text"
              onClick={() => setShowDiscordHelp(false)}
              aria-label="閉じる"
            >
              ✕
            </button>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="space-y-3 rounded-xl border border-border bg-card2 px-4 py-3 text-sm">
              <p className="font-semibold">Botとのトークを始める手順</p>
              <ol className="space-y-2 text-text2">
                <li>① 設定画面の「Discordと連携する」でアカウント連携</li>
                <li>
                  ② Discord上でBotを検索してDMを開く
                  {discordClientId && (
                    <>
                      （
                      <a
                        href={`https://discord.com/users/${discordClientId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        Botのプロフィールを開く
                      </a>
                      ）
                    </>
                  )}
                </li>
                <li>③ BotにDMを送ると支出を登録できます</li>
              </ol>
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-card2 px-4 py-3 text-sm">
              <p className="font-semibold">使えるコマンド</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">ランチ 850円</td>
                    <td className="py-1.5 text-text2">支出を登録</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">サマリー</td>
                    <td className="py-1.5 text-text2">今月の支出合計を確認</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">ヘルプ</td>
                    <td className="py-1.5 text-text2">使い方一覧を表示</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-mono text-accent">レシート画像</td>
                    <td className="py-1.5 text-text2">OCRで自動登録</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text2">
              ※ BotへのDMが届かない場合は、DiscordのプライバシーとセキュリティでサーバーメンバーからのDMを許可してください。
            </p>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { listActiveConnectionsWithNotifSettings } from '../db/repositories/connections'
import { countTodayTransactions } from '../db/repositories/transactions'
import { env } from '../lib/env'
import { buildSummaryMessageText } from './bot-core'
import { pushDiscordDM } from './discord'
import { pushLineText } from './line'

// ─────────────────────────────────────────────
// メッセージテンプレート
// ─────────────────────────────────────────────

const DAILY_REMINDER_TEXT = `📝 今日の支出がまだ記録されていません！

外食・交通費・買い物など、今日使ったお金を記録しましょう✏️
「ランチ 850円」のように送るだけで登録できます。

毎日の記録が家計改善への第一歩です💪`

function buildWeeklySummaryText(summary: string): string {
  const header = '🗓 今週のサマリーをお届けします！'
  const actualUrl = `${env.FRONTEND_URL}/dashboard`
  const body = summary.replace('https://lifebalance.app/dashboard', actualUrl)
  return `${header}\n\n${body}\n\nダッシュボードで詳細を確認しましょう👆`
}

function buildMonthlySummaryText(summary: string): string {
  const header = '📅 先月の家計サマリーをお届けします！'
  const actualUrl = `${env.FRONTEND_URL}/dashboard`
  const body = summary.replace('https://lifebalance.app/dashboard', actualUrl)
  return `${header}\n\n${body}\n\nダッシュボードで詳細を確認しましょう👆`
}

// ─────────────────────────────────────────────
// 今日の JST 日付 (YYYY-MM-DD)
// ─────────────────────────────────────────────

function getTodayUTCDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 先月の YYYY-MM を返す */
function getPreviousYearMonth(): string {
  const now = new Date()
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return prev.toISOString().slice(0, 7)
}

// ─────────────────────────────────────────────
// デイリーリマインダー（21:00 JST）
// notificationReminder + プラットフォーム通知が ON のユーザーのみ
// ─────────────────────────────────────────────

export async function sendDailyReminder(): Promise<void> {
  const today = getTodayUTCDate()

  const [lineConnections, discordConnections] = await Promise.all([
    listActiveConnectionsWithNotifSettings('line'),
    listActiveConnectionsWithNotifSettings('discord'),
  ])

  const lineResults = await Promise.allSettled(
    lineConnections
      .filter((conn) => conn.notificationReminder && conn.notificationLine)
      .map(async (conn) => {
        const todayCount = await countTodayTransactions(conn.userId, today)
        if (todayCount > 0) return
        await pushLineText(conn.platformUserId, DAILY_REMINDER_TEXT)
      }),
  )

  const discordResults = await Promise.allSettled(
    discordConnections
      .filter((conn) => conn.notificationReminder && conn.notificationDiscord)
      .map(async (conn) => {
        const todayCount = await countTodayTransactions(conn.userId, today)
        if (todayCount > 0) return
        await pushDiscordDM(conn.platformUserId, DAILY_REMINDER_TEXT)
      }),
  )

  const lineSent = lineResults.filter((r) => r.status === 'fulfilled').length
  const discordSent = discordResults.filter((r) => r.status === 'fulfilled').length
  console.log(
    `[notifications] デイリーリマインダー: LINE ${lineSent}/${lineConnections.length}, Discord ${discordSent}/${discordConnections.length}`,
  )
}

// ─────────────────────────────────────────────
// 週次サマリー（日曜 20:00 JST）
// notificationWeekly + プラットフォーム通知が ON のユーザーのみ
// ─────────────────────────────────────────────

export async function sendWeeklySummary(): Promise<void> {
  const [lineConnections, discordConnections] = await Promise.all([
    listActiveConnectionsWithNotifSettings('line'),
    listActiveConnectionsWithNotifSettings('discord'),
  ])

  const lineResults = await Promise.allSettled(
    lineConnections
      .filter((conn) => conn.notificationWeekly && conn.notificationLine)
      .map(async (conn) => {
        const summary = await buildSummaryMessageText(conn.userId)
        await pushLineText(conn.platformUserId, buildWeeklySummaryText(summary))
      }),
  )

  const discordResults = await Promise.allSettled(
    discordConnections
      .filter((conn) => conn.notificationWeekly && conn.notificationDiscord)
      .map(async (conn) => {
        const summary = await buildSummaryMessageText(conn.userId)
        await pushDiscordDM(conn.platformUserId, buildWeeklySummaryText(summary))
      }),
  )

  const lineSent = lineResults.filter((r) => r.status === 'fulfilled').length
  const discordSent = discordResults.filter((r) => r.status === 'fulfilled').length
  console.log(
    `[notifications] 週次サマリー: LINE ${lineSent}/${lineConnections.length}, Discord ${discordSent}/${discordConnections.length}`,
  )
}

// ─────────────────────────────────────────────
// 月次サマリー（毎月1日 9:00 JST）
// 先月分のサマリーを notificationMonthly + プラットフォーム通知が ON のユーザーに送信
// ─────────────────────────────────────────────

export async function sendMonthlySummary(): Promise<void> {
  const prevYearMonth = getPreviousYearMonth()

  const [lineConnections, discordConnections] = await Promise.all([
    listActiveConnectionsWithNotifSettings('line'),
    listActiveConnectionsWithNotifSettings('discord'),
  ])

  const lineResults = await Promise.allSettled(
    lineConnections
      .filter((conn) => conn.notificationMonthly && conn.notificationLine)
      .map(async (conn) => {
        const summary = await buildSummaryMessageText(conn.userId, prevYearMonth)
        await pushLineText(conn.platformUserId, buildMonthlySummaryText(summary))
      }),
  )

  const discordResults = await Promise.allSettled(
    discordConnections
      .filter((conn) => conn.notificationMonthly && conn.notificationDiscord)
      .map(async (conn) => {
        const summary = await buildSummaryMessageText(conn.userId, prevYearMonth)
        await pushDiscordDM(conn.platformUserId, buildMonthlySummaryText(summary))
      }),
  )

  const lineSent = lineResults.filter((r) => r.status === 'fulfilled').length
  const discordSent = discordResults.filter((r) => r.status === 'fulfilled').length
  console.log(
    `[notifications] 月次サマリー: LINE ${lineSent}/${lineConnections.length}, Discord ${discordSent}/${discordConnections.length}`,
  )
}

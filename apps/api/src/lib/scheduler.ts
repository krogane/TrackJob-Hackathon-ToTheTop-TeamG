/**
 * setTimeout ベースのシンプルなタスクスケジューラ
 * UTC 時刻を指定して、毎日 or 毎週繰り返し実行する
 */

/** 次回の「毎日 hour:minute UTC」までのミリ秒を返す */
function msUntilNextDailyUTC(hour: number, minute: number): number {
  const now = new Date()
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0),
  )
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1)
  }
  return next.getTime() - now.getTime()
}

/** 次回の「毎月 day 日の hour:minute UTC」までのミリ秒を返す */
function msUntilNextMonthlyUTC(day: number, hour: number, minute: number): number {
  const now = new Date()
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute, 0, 0),
  )
  if (next.getTime() <= now.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next.getTime() - now.getTime()
}

/** 次回の「毎週 dayOfWeek の hour:minute UTC」までのミリ秒を返す (0=日曜) */
function msUntilNextWeeklyUTC(dayOfWeek: number, hour: number, minute: number): number {
  const now = new Date()
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0),
  )
  let daysUntil = (dayOfWeek - now.getUTCDay() + 7) % 7
  if (daysUntil === 0 && next.getTime() <= now.getTime()) {
    daysUntil = 7
  }
  next.setUTCDate(next.getUTCDate() + daysUntil)
  next.setUTCHours(hour, minute, 0, 0)
  return next.getTime() - now.getTime()
}

function scheduleRepeat(name: string, getDelay: () => number, fn: () => Promise<void>) {
  const runAndReschedule = async () => {
    try {
      console.log(`[scheduler] ${name} 開始`)
      await fn()
      console.log(`[scheduler] ${name} 完了`)
    } catch (error) {
      console.error(`[scheduler] ${name} エラー:`, error)
    }
    const delay = getDelay()
    console.log(
      `[scheduler] ${name} 次回: ${new Date(Date.now() + delay).toISOString()} (約${Math.round(delay / 60000)}分後)`,
    )
    setTimeout(runAndReschedule, delay)
  }

  const delay = getDelay()
  console.log(
    `[scheduler] ${name} 初回: ${new Date(Date.now() + delay).toISOString()} (約${Math.round(delay / 60000)}分後)`,
  )
  setTimeout(runAndReschedule, delay)
}

export function startScheduler(handlers: {
  onDailyReminder: () => Promise<void>
  onWeeklySummary: () => Promise<void>
  onMonthlySummary: () => Promise<void>
}) {
  // 21:00 JST = 12:00 UTC
  scheduleRepeat(
    'デイリーリマインダー（21:00 JST）',
    () => msUntilNextDailyUTC(12, 0),
    handlers.onDailyReminder,
  )

  // 日曜 20:00 JST = 日曜 11:00 UTC (dayOfWeek=0)
  scheduleRepeat(
    '週次サマリー（日曜 20:00 JST）',
    () => msUntilNextWeeklyUTC(0, 11, 0),
    handlers.onWeeklySummary,
  )

  // 毎月1日 9:00 JST = 毎月1日 0:00 UTC
  scheduleRepeat(
    '月次サマリー（毎月1日 9:00 JST）',
    () => msUntilNextMonthlyUTC(1, 0, 0),
    handlers.onMonthlySummary,
  )
}

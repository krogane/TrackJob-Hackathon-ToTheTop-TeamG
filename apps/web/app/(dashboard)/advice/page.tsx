'use client'

import { ScoreHistoryChart } from '@/components/charts/ScoreHistoryChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdvice } from '@/hooks/useAdvice'

export default function AdvicePage() {
  const { advice, history, loading, refreshing, error, refresh } = useAdvice()

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAI</h1>
        <p className="text-sm text-text2">読み込み中...</p>
      </div>
    )
  }

  if (!advice) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAI</h1>
        <p className="text-sm text-danger">{error ?? 'アドバイスがありません。'}</p>
        <Button onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? '更新中...' : '再取得する'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em] text-text">KakeAI</h1>
          <p className="text-sm text-text2">緊急度と改善効果に応じた家計アクションを確認できます</p>
        </div>
        <Button className="text-text" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? '更新中...' : 'KakeAIを更新'}
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card className="bg-card">
        <CardContent className="grid gap-4 py-6 md:grid-cols-2">
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
            <p className="text-xs text-text2">家計スコア</p>
            <p className="font-display text-5xl font-bold text-accent">{advice.score}</p>
            <p className="text-xs text-text2">100点満点</p>
          </div>
          <ScoreHistoryChart data={history} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdviceSection title="緊急アクション" items={advice.content.urgent} tone="border-danger/25 bg-danger/10" />
        <AdviceSection title="改善提案" items={advice.content.suggestions} tone="border-warn/35 bg-warn/20" />
        <AdviceSection title="継続中の良い点" items={advice.content.positives} tone="border-accent/30 bg-accent/10" />
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-accent">来月の目標</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-text2">
            {advice.content.next_month_goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function AdviceSection({ title, items, tone }: { title: string; items: Array<{ title: string; body: string }>; tone: string }) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-accent">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <article key={item.title} className={`rounded-lg border p-3 ${tone}`}>
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-1 text-xs text-text2">{item.body}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}

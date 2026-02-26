'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface ScorePoint {
  month: string
  score: number
}

interface ScoreHistoryChartProps {
  data: ScorePoint[]
}

export function ScoreHistoryChart({ data }: ScoreHistoryChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="month" stroke="var(--text2)" fontSize={12} />
          <YAxis domain={[0, 100]} stroke="var(--text2)" fontSize={12} />
          <Tooltip
            formatter={(value: number) => `${value}点`}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--chart-tooltip-shadow)',
            }}
          />
          <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={3} dot={{ fill: 'var(--accent)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

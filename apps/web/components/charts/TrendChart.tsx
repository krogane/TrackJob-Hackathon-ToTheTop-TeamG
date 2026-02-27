'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface TrendPoint {
  label: string
  expense: number
  saving?: number
  budget?: number
}

interface TrendChartProps {
  data: TrendPoint[]
  range?: '1m' | '3m' | '1y'
}

export function TrendChart({ data, range }: TrendChartProps) {
  const budgetLabel =
    range === '1m' ? '予算上限（日割り）' : range === '3m' ? '予算上限（週割り）' : '予算上限（月割り）'
  const budgetLimit = data.find((d) => d.budget !== undefined)?.budget ?? 0
  const yAxisDomain = budgetLimit > 0 ? ([0, Math.ceil(budgetLimit * 1.2)] as [number, number]) : undefined

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="label" stroke="var(--text2)" fontSize={12} />
          <YAxis stroke="var(--text2)" fontSize={12} domain={yAxisDomain} />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--chart-tooltip-shadow)',
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="expense" stroke="var(--accent)" strokeWidth={2.4} dot={false} name="支出" />
          {data.some((d) => d.budget !== undefined) && (
            <Line
              type="monotone"
              dataKey="budget"
              stroke="var(--warn)"
              strokeWidth={2.2}
              strokeDasharray="7 6"
              dot={false}
              name={budgetLabel}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

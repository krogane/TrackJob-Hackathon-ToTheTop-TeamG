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
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="label" stroke="var(--text2)" fontSize={12} />
          <YAxis stroke="var(--text2)" fontSize={12} />
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
              name="予算上限"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

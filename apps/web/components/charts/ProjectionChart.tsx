'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ProjectionPoint {
  year: number
  p5: number
  p50: number
  p95: number
}

interface ProjectionChartProps {
  data: ProjectionPoint[]
  targetLine?: number
}

export function ProjectionChart({ data, targetLine = 5000000 }: ProjectionChartProps) {
  const bandData = data.map((item) => ({ ...item, range: item.p95 - item.p5 }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={bandData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="year" stroke="var(--text2)" fontSize={12} />
          <YAxis stroke="var(--text2)" fontSize={12} />
          <Tooltip
            formatter={(value: number) => `¥${value.toLocaleString('ja-JP')}`}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--chart-tooltip-shadow)',
            }}
          />
          <Legend />
          <ReferenceLine y={targetLine} stroke="var(--danger)" strokeDasharray="6 4" label="目標ライン" />
          <Area type="monotone" dataKey="p5" stackId="band" stroke="transparent" fill="rgba(74,240,176,0.1)" />
          <Area type="monotone" dataKey="range" stackId="band" stroke="transparent" fill="rgba(74,240,176,0.24)" name="90%信頼区間" />
          <Line type="monotone" dataKey="p50" stroke="var(--accent)" strokeWidth={3} dot={false} name="中央値 p50" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

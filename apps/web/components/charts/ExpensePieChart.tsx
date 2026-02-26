'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface PieData {
  name: string
  value: number
  color: string
}

interface ExpensePieChartProps {
  data: PieData[]
}

const RADIAN = Math.PI / 180

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight="bold">
      {`${Math.round(percent * 100)}%`}
    </text>
  )
}

export function ExpensePieChart({ data }: ExpensePieChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={140}
            innerRadius={80}
            labelLine={false}
            label={renderCustomLabel}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => `¥${value.toLocaleString('ja-JP')}`}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--chart-tooltip-shadow)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

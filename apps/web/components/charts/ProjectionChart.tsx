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
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

interface ProjectionPoint {
  year: number
  age: number
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
}

interface ProjectionChartProps {
  data: ProjectionPoint[]
  targetLine?: number
}

const formatCurrency = (value: number) => `¥${value.toLocaleString('ja-JP')}`

type TooltipPayload = TooltipProps<ValueType, NameType>['payload']
type ProjectionXAxisTickProps = {
  x: number
  y: number
  payload: { value: string | number }
}

function ProjectionTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string | number
  payload?: TooltipPayload
}) {
  if (!active || !payload || payload.length === 0 || typeof label !== 'number') {
    return null
  }

  const point = payload[0]?.payload as ProjectionPoint | undefined
  const ageText = typeof point?.age === 'number' ? `${point.age}歳` : '-歳'

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: 'var(--chart-tooltip-shadow)',
        padding: '8px 10px',
        minWidth: 170,
      }}
    >
      <p className="mb-1 text-sm font-semibold text-text">{`${label}年 ${ageText}`}</p>
      <div className="space-y-0.5 text-[11px] text-text2">
        <p>{`中央値: ${formatCurrency(point?.p50 ?? 0)}`}</p>
        <p>{`下限(p5): ${formatCurrency(point?.p5 ?? 0)}`}</p>
        <p>{`上限(p95): ${formatCurrency(point?.p95 ?? 0)}`}</p>
      </div>
    </div>
  )
}

export function ProjectionChart({ data, targetLine = 5000000 }: ProjectionChartProps) {
  const baseAge = data[0]?.age
  const baseYear = data[0]?.year
  const ageLabelDy = 22
  const bandData = data.map((item) => ({ ...item, range: item.p95 - item.p5 }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={bandData} margin={{ top: 8, right: 28, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="year"
            stroke="var(--text2)"
            fontSize={12}
            height={40}
            interval={0}
            tick={(props: ProjectionXAxisTickProps) => {
              const { x, y, payload } = props
              const year = Number(payload.value)
              const target = data.find((point) => point.year === year)
              const showYear = typeof baseYear === 'number' && (year - baseYear) % 2 === 0
              const showAge = typeof target?.age === 'number' && typeof baseAge === 'number' && (target.age - baseAge) % 5 === 0

              return (
                <g transform={`translate(${x},${y})`}>
                  {showYear ? (
                    <text x={0} y={0} dy={8} textAnchor="middle" fill="var(--text2)" fontSize={12}>
                      {year}
                    </text>
                  ) : null}
                  {showAge ? (
                    <text x={0} y={0} dy={ageLabelDy} textAnchor="middle" fill="var(--text2)" fontSize={11}>
                      {`${target.age}歳`}
                    </text>
                  ) : null}
                </g>
              )
            }}
          />
          <YAxis
            width={92}
            tickMargin={8}
            stroke="var(--text2)"
            fontSize={12}
            tickFormatter={(value) => formatCurrency(Number(value))}
          />
          <Tooltip
            content={<ProjectionTooltip />}
            cursor={{ stroke: 'var(--accent2)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
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

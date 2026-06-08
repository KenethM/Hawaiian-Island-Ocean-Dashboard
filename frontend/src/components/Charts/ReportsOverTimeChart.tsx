import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { DiverStatOverTime } from '../../types'

interface Props {
  data: DiverStatOverTime[]
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function barColor(bleaching: number | null) {
  if (bleaching === null) return '#0ea5e9'
  if (bleaching >= 50) return '#ef4444'
  if (bleaching >= 25) return '#f97316'
  return '#22c55e'
}

export function ReportsOverTimeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-gray-400 text-sm gap-1">
        <span className="text-2xl">🤿</span>
        <span>No reports yet — submit a dive observation to get started.</span>
      </div>
    )
  }

  const chartData = data.map(d => ({
    date: fmt(d.date),
    reports: d.count,
    bleaching: d.avg_bleaching_pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: number, name: string) => [v, name]}
          labelFormatter={label => `Date: ${label}`}
        />
        <Bar dataKey="reports" name="Diver Reports" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.bleaching)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

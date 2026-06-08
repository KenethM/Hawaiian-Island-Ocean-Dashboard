import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { DiverStatOverTime } from '../../types'

interface Props {
  data: DiverStatOverTime[]
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const EmptyState = ({ message }: { message: string }) => (
  <div className="h-52 flex flex-col items-center justify-center text-gray-400 text-sm gap-1">
    <span className="text-2xl">🪸</span>
    <span>{message}</span>
  </div>
)

export function BleachingHistoryChart({ data }: Props) {
  const withBleaching = data.filter(d => d.avg_bleaching_pct !== null)

  if (data.length === 0) {
    return <EmptyState message="No diver reports yet — be the first to log a dive." />
  }
  if (withBleaching.length === 0) {
    return <EmptyState message="Reports exist but none include bleaching observations." />
  }

  const chartData = data.map(d => ({
    date: fmt(d.date),
    bleaching: d.avg_bleaching_pct,
    coralCover: d.avg_coral_cover_pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip formatter={(v: number | null) => v !== null ? `${v.toFixed(1)}%` : '—'} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={25} stroke="#f97316" strokeDasharray="4 2"
          label={{ value: 'Mild', fontSize: 9, fill: '#f97316', position: 'right' }} />
        <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 2"
          label={{ value: 'Moderate', fontSize: 9, fill: '#ef4444', position: 'right' }} />
        <Area
          type="monotone"
          dataKey="bleaching"
          name="Avg Bleaching %"
          stroke="#ef4444"
          fill="#fecaca"
          fillOpacity={0.5}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="coralCover"
          name="Avg Coral Cover %"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

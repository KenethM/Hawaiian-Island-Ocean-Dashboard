import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../../services/api'
import type { SstYoY } from '../../types'

interface Props { siteId: string; mmm: number }

export function SstYoYChart({ siteId, mmm }: Props) {
  const [data, setData] = useState<SstYoY | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getSstYoY(siteId)
      .then(d => { setData(d); setError(null) })
      .catch(() => setError('Year-over-year data unavailable'))
      .finally(() => setLoading(false))
  }, [siteId])

  if (loading) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading comparison…</div>
  if (error || !data) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{error}</div>

  // Align by day-of-year index so both series overlay correctly
  const maxLen = Math.max(data.this_year.length, data.last_year.length)
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    idx: i,
    thisYear: data.this_year[i]?.sst_c ?? null,
    lastYear: data.last_year[i]?.sst_c ?? null,
    label: data.this_year[i]?.time.slice(5, 10) ?? data.last_year[i]?.time.slice(5, 10) ?? '',
  }))

  const thisYearLabel = new Date().getFullYear().toString()
  const lastYearLabel = (new Date().getFullYear() - 1).toString()

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={29} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} />
          <Tooltip
            formatter={(val: number, name: string) => [`${val?.toFixed(2)}°C`, name]}
            contentStyle={{ fontSize: 11 }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <ReferenceLine y={mmm} stroke="#f97316" strokeDasharray="3 2" label={{ value: 'MMM', fontSize: 8, fill: '#f97316', position: 'right' }} />
          <ReferenceLine y={mmm + 1} stroke="#ef4444" strokeDasharray="3 2" label={{ value: 'Watch', fontSize: 8, fill: '#ef4444', position: 'right' }} />
          <Line type="monotone" dataKey="thisYear" name={thisYearLabel} dot={false} stroke="#3b82f6" strokeWidth={2} connectNulls={false} />
          <Line type="monotone" dataKey="lastYear" name={lastYearLabel} dot={false} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1">
        Solid = {thisYearLabel} · Dashed = {lastYearLabel} · Orange = MMM · Red = Bleaching Watch threshold
      </p>
    </div>
  )
}

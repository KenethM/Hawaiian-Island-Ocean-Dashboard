import { useState, useEffect } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../../services/api'
import type { DhwForecast } from '../../types'

interface Props { siteId: string; mmm: number }

export function DhwForecastChart({ siteId, mmm }: Props) {
  const [data, setData] = useState<DhwForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getDhwForecast(siteId)
      .then(d => { setData(d); setError(null) })
      .catch(() => setError('DHW forecast unavailable'))
      .finally(() => setLoading(false))
  }, [siteId])

  if (loading) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading forecast…</div>
  if (error || !data) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{error}</div>

  // Combine historical + forecast into a single chart dataset
  const chartData = [
    ...data.historical_readings.slice(-42).map(r => ({
      label: r.time.slice(0, 10),
      sst: r.sst_c,
      dhw: null as number | null,
      projected_sst: null as number | null,
    })),
    ...data.forecast.map(f => ({
      label: `+${f.day}d`,
      sst: null as number | null,
      dhw: f.accumulated_dhw,
      projected_sst: f.projected_sst_c,
    })),
  ]

  const trend = data.sst_trend_per_day > 0 ? 'warming' : data.sst_trend_per_day < -0.005 ? 'cooling' : 'stable'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">
          Current DHW: <strong className={`${data.current_dhw >= 8 ? 'text-red-600' : data.current_dhw >= 4 ? 'text-orange-500' : 'text-gray-800'}`}>
            {data.current_dhw.toFixed(1)} °C-weeks
          </strong>
          <span className="ml-2 text-gray-400">· SST trend: {trend} ({data.sst_trend_per_day > 0 ? '+' : ''}{(data.sst_trend_per_day * 7).toFixed(2)}°C/wk)</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={13} />
          <YAxis yAxisId="sst" domain={['auto', 'auto']} tick={{ fontSize: 9 }} />
          <YAxis yAxisId="dhw" orientation="right" tick={{ fontSize: 9 }} />
          <Tooltip
            formatter={(val: number, name: string) => {
              if (name === 'SST') return [`${val.toFixed(2)}°C`, 'Observed SST']
              if (name === 'Proj SST') return [`${val.toFixed(2)}°C`, 'Projected SST']
              if (name === 'DHW') return [`${val.toFixed(1)} °C-wks`, 'Accumulated DHW']
              return [val, name]
            }}
            contentStyle={{ fontSize: 11 }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <ReferenceLine yAxisId="dhw" y={4} stroke="#f97316" strokeDasharray="4 2" label={{ value: 'Bleaching likely', fontSize: 8, fill: '#f97316' }} />
          <ReferenceLine yAxisId="dhw" y={8} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Mass bleaching', fontSize: 8, fill: '#ef4444' }} />
          <Line yAxisId="sst" type="monotone" dataKey="sst" name="SST" dot={false} stroke="#3b82f6" strokeWidth={1.5} connectNulls={false} />
          <Line yAxisId="sst" type="monotone" dataKey="projected_sst" name="Proj SST" dot={false} stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 2" connectNulls={false} />
          <Area yAxisId="dhw" type="monotone" dataKey="dhw" name="DHW" fill="#fecaca" stroke="#ef4444" strokeWidth={1.5} fillOpacity={0.5} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1">Shaded area = projected DHW if current trend continues 28 days · dashed line = projected SST</p>
    </div>
  )
}

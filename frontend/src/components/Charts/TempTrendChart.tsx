import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { useSstHistory } from '../../hooks/useSstHistory'
import { useChartTheme } from '../../hooks/useChartTheme'

interface Props {
  siteId: string
  mmm: number
  /** Chart height in px — the mobile detail screen renders these shorter than the desktop panel. */
  height?: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TempTrendChart({ siteId, mmm, height = 220 }: Props) {
  const { history, loading, error } = useSstHistory(siteId, 60)
  const t = useChartTheme()

  if (loading) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading SST data…</div>
  if (error) return <div className="h-48 flex items-center justify-center text-red-400 text-sm">{error}</div>
  if (!history || history.readings.length === 0) {
    return (
      <div className="h-32 flex flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">No SST history for this site yet.</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          The MUR satellite grid doesn&apos;t resolve every reef — remote sites often have no daily record.
        </p>
      </div>
    )
  }

  const data = history.readings.map(r => ({
    date: formatDate(r.time),
    sst: r.sst_c,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.axis }} stroke={t.grid} interval="preserveStartEnd" />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: t.axis }} stroke={t.grid} unit="°C" />
        <Tooltip formatter={(v: number) => `${v.toFixed(2)}°C`} contentStyle={t.tooltip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={mmm + 1} stroke="#f97316" strokeDasharray="4 2" label={{ value: 'Watch', fontSize: 10, fill: '#f97316', position: 'right' }} />
        <ReferenceLine y={mmm + 2} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Warning', fontSize: 10, fill: '#ef4444', position: 'right' }} />
        <Line
          type="monotone"
          dataKey="sst"
          name="SST (°C)"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

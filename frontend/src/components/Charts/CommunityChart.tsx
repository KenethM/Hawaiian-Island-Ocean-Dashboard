import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { SiteStat } from '../../types'

interface Props {
  stats: SiteStat[]
  siteNames: Record<string, string>
}

export function CommunityChart({ stats, siteNames }: Props) {
  if (stats.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No diver reports yet.</div>
  }

  const data = stats
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(s => ({
      name: siteNames[s.reef_site_id] ?? s.reef_site_id,
      reports: s.count,
      avgBleaching: s.avg_bleaching_pct ?? 0,
    }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="reports" name="Diver Reports" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avgBleaching > 50 ? '#ef4444' : entry.avgBleaching > 20 ? '#f97316' : '#22c55e'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

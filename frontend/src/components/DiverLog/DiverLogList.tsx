import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { DiverLog, ReefSite } from '../../types'

interface Props {
  siteId?: string
  sites: ReefSite[]
  refresh: number
}

const SEVERITY_COLOR: Record<string, string> = {
  none: 'bg-green-100 text-green-700',
  mild: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  severe: 'bg-red-100 text-red-700',
  mortality: 'bg-gray-900 text-white',
}

const PAGE_SIZE = 20

export function DiverLogList({ siteId, sites, refresh }: Props) {
  const [logs, setLogs] = useState<DiverLog[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [hasMore, setHasMore] = useState(false)

  const siteName = (id: string) => sites.find(s => s.id === id)?.name ?? id

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [siteId, refresh])

  useEffect(() => {
    setLoading(true)
    api.getDiverLogs(siteId)
      .then(all => {
        setLogs(all.slice(0, limit))
        setHasMore(all.length > limit)
      })
      .finally(() => setLoading(false))
  }, [siteId, refresh, limit])

  if (loading) return <p className="text-gray-400 text-sm py-4 text-center">Loading logs…</p>
  if (logs.length === 0) return <p className="text-gray-400 text-sm py-4 text-center">No observations yet.</p>

  return (
    <div>
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {logs.map(log => (
          <div key={log.id} className="border border-gray-200 rounded-lg p-3 text-sm bg-white">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-gray-800">{siteName(log.reef_site_id)}</span>
              <span className="text-gray-400 text-xs whitespace-nowrap">{log.dive_date}</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {log.bleaching_severity && (
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-medium ${SEVERITY_COLOR[log.bleaching_severity] ?? ''}`}>
                  {log.bleaching_severity}
                </span>
              )}
              {log.coral_cover_pct != null && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                  Cover: {log.coral_cover_pct}%
                </span>
              )}
              {log.bleaching_pct != null && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700">
                  Bleached: {log.bleaching_pct}%
                </span>
              )}
              {log.water_temp_c != null && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-sky-50 text-sky-700">
                  {log.water_temp_c}°C
                </span>
              )}
            </div>

            {log.species_notes && (
              <p className="text-gray-600 text-xs italic">{log.species_notes}</p>
            )}
            {log.diver_name && (
              <p className="text-gray-400 text-xs mt-1">— {log.diver_name}</p>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setLimit(l => l + PAGE_SIZE)}
          className="mt-3 w-full text-sm text-ocean-700 hover:text-ocean-900 font-medium py-1.5 border border-ocean-200 rounded-md hover:bg-ocean-50 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  )
}

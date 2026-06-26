import type { DiverLogWithCoords } from '../../hooks/useDiverLogs'

const SEVERITY_COLOR: Record<string, string> = {
  none: '#22c55e',
  mild: '#fbbf24',
  moderate: '#f97316',
  severe: '#ef4444',
  mortality: '#991b1b',
}

interface Props {
  logs: DiverLogWithCoords[]
  loading: boolean
  onSelectSite?: (id: string) => void
}

export function RecentSightingsFeed({ logs, loading, onSelectSite }: Props) {
  return (
    <div className="w-full md:w-80 xl:w-96 flex-shrink-0 bg-white dark:bg-slate-800 border-t md:border-t-0 border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Sightings</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Last 90 days · click to go to site</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">Loading…</div>
        )}
        {!loading && logs.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
            No diver reports in the last 90 days.
          </div>
        )}
        {!loading && logs.map(log => (
          <button
            key={log.id}
            className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => onSelectSite?.(log.reef_site_id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-xs text-gray-900 dark:text-white truncate">{log.siteName}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{log.dive_date} · {log.diver_name ?? 'Anonymous'}</p>
              </div>
              {log.bleaching_severity && (
                <span
                  className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white capitalize"
                  style={{ background: SEVERITY_COLOR[log.bleaching_severity] ?? '#94a3b8' }}
                >
                  {log.bleaching_severity}
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-slate-400">
              {log.bleaching_pct != null && <span>Bleach: {log.bleaching_pct}%</span>}
              {log.coral_cover_pct != null && <span>Cover: {log.coral_cover_pct}%</span>}
              {log.depth_m != null && <span>{log.depth_m} m</span>}
            </div>

            {log.general_notes && (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500 line-clamp-2 italic">{log.general_notes}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

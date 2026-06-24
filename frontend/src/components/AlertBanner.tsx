import { useAlerts } from '../hooks/useAlerts'

export function AlertBanner() {
  const { alerts, loading, error } = useAlerts()

  if (loading) return null

  if (error) {
    return (
      <div className="bg-yellow-600 text-white px-4 py-1.5 text-xs text-center">
        Alert data unavailable — {error}
      </div>
    )
  }

  if (!alerts || alerts.count === 0) return null

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-lg font-bold animate-pulse">⚠</span>
      <span className="font-semibold">
        {alerts.count} active bleaching alert{alerts.count > 1 ? 's' : ''}:
      </span>
      <span className="text-sm">
        {alerts.alerts.map(a => {
          const parts = [a.name, a.alert.label]
          if (a.sst_c !== null) parts.push(`SST ${a.sst_c.toFixed(1)}°C`)
          if (a.dhw !== null) parts.push(`DHW ${a.dhw.toFixed(1)}°C-wk`)
          return parts.join(' · ')
        }).join('  |  ')}
      </span>
    </div>
  )
}

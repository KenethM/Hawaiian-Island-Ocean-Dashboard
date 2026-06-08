import { useAlerts } from '../hooks/useAlerts'

export function AlertBanner() {
  const { alerts, loading } = useAlerts()

  if (loading || !alerts || alerts.count === 0) return null

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-lg font-bold animate-pulse">⚠</span>
      <span className="font-semibold">
        {alerts.count} active bleaching alert{alerts.count > 1 ? 's' : ''}:
      </span>
      <span className="text-sm">
        {alerts.alerts.map(a => `${a.name} (${a.alert.label} — ${a.sst_c?.toFixed(1)}°C)`).join(' · ')}
      </span>
    </div>
  )
}

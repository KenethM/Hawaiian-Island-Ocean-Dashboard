import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { DiverLog, ReefSite } from '../types'

export interface DiverLogWithCoords extends DiverLog {
  lat: number
  lng: number
  siteName: string
}

export function useDiverLogs(sites: ReefSite[], days = 90) {
  const [logs, setLogs] = useState<DiverLogWithCoords[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sites.length) return
    setLoading(true)
    api.getRecentDiverLogs(days)
      .then(rawLogs => {
        const siteMap = new Map(sites.map(s => [s.id, s]))
        const enriched: DiverLogWithCoords[] = rawLogs.flatMap(log => {
          const site = siteMap.get(log.reef_site_id)
          if (!site) return []
          return [{ ...log, lat: site.lat, lng: site.lng, siteName: site.name }]
        })
        setLogs(enriched)
        setError(null)
      })
      .catch(() => setError('Failed to load diver logs'))
      .finally(() => setLoading(false))
  }, [sites, days])

  return { logs, loading, error }
}

import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { ReefSite } from '../types'

export function useCurrentConditions(refreshMs = 300_000) {
  const [sites, setSites] = useState<ReefSite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const data = await api.getCurrentConditions()
        if (active) { setSites(data); setError(null) }
      } catch {
        if (active) setError('Could not load reef conditions from NOAA.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, refreshMs)
    return () => { active = false; clearInterval(timer) }
  }, [refreshMs])

  return { sites, loading, error }
}

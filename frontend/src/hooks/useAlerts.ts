import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { ActiveAlerts } from '../types'

export function useAlerts(refreshMs = 300_000) {
  const [alerts, setAlerts] = useState<ActiveAlerts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const data = await api.getActiveAlerts()
        if (active) setAlerts(data)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, refreshMs)
    return () => { active = false; clearInterval(timer) }
  }, [refreshMs])

  return { alerts, loading }
}

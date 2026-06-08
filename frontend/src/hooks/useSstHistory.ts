import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { SstHistory } from '../types'

export function useSstHistory(siteId: string | null, days = 30) {
  const [history, setHistory] = useState<SstHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!siteId) { setHistory(null); return }
    let active = true
    setLoading(true)

    api.getSstHistory(siteId, days)
      .then(data => { if (active) { setHistory(data); setError(null) } })
      .catch(() => { if (active) setError('Could not load SST history.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [siteId, days])

  return { history, loading, error }
}

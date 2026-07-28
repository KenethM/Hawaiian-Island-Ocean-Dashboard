import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { ReefSite } from '../../types'

interface TideSummary {
  state: 'rising' | 'falling'
  heightFt: number
}

export function useReefPulseExtras(sites: ReefSite[]) {
  const [tide, setTide] = useState<TideSummary | null>(null)
  const [clearestM, setClearestM] = useState<number | null>(null)

  useEffect(() => {
    if (sites.length === 0) return
    let active = true

    api.getTides(sites[0].id)
      .then(data => {
        if (!active || !data.tide_state || !data.current) return
        setTide({ state: data.tide_state, heightFt: data.current.height_m * 3.28084 })
      })
      .catch(() => {})

    Promise.all(sites.map(s => api.getTurbidity(s.id).catch(() => null)))
      .then(results => {
        if (!active) return
        const values = results
          .map(r => r?.latest?.estimated_visibility_m)
          .filter((v): v is number => v != null)
        if (values.length) setClearestM(Math.max(...values))
      })

    return () => { active = false }
  }, [sites])

  return { tide, clearestM }
}

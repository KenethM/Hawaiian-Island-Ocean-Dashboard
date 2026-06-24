import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { TideData, WaveData, TurbidityData, SalinityData } from '../types'

export interface OceanConditions {
  tides: TideData | null
  waves: WaveData | null
  turbidity: TurbidityData | null
  salinity: SalinityData | null
  loading: boolean
  fetchedAt: Date | null
}

export function useOceanConditions(siteId: string): OceanConditions {
  const [state, setState] = useState<OceanConditions>({
    tides: null,
    waves: null,
    turbidity: null,
    salinity: null,
    loading: true,
    fetchedAt: null,
  })

  useEffect(() => {
    setState(prev => ({ ...prev, loading: true }))
    Promise.all([
      api.getTides(siteId).catch(() => null),
      api.getWaves(siteId).catch(() => null),
      api.getTurbidity(siteId).catch(() => null),
      api.getSalinity(siteId).catch(() => null),
    ]).then(([tides, waves, turbidity, salinity]) => {
      setState({ tides, waves, turbidity, salinity, loading: false, fetchedAt: new Date() })
    })
  }, [siteId])

  return state
}

import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { TideData, WaveData, TurbidityData } from '../types'

export interface OceanConditions {
  tides: TideData | null
  waves: WaveData | null
  turbidity: TurbidityData | null
  loading: boolean
}

export function useOceanConditions(siteId: string): OceanConditions {
  const [state, setState] = useState<OceanConditions>({
    tides: null,
    waves: null,
    turbidity: null,
    loading: true,
  })

  useEffect(() => {
    setState(prev => ({ ...prev, loading: true }))
    Promise.all([
      api.getTides(siteId).catch(() => null),
      api.getWaves(siteId).catch(() => null),
      api.getTurbidity(siteId).catch(() => null),
    ]).then(([tides, waves, turbidity]) => {
      setState({ tides, waves, turbidity, loading: false })
    })
  }, [siteId])

  return state
}

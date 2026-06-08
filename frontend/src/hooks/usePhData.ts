import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api'
import type { PhTrendPoint, PhPrediction, PhSourceInfo } from '../types'

export type PhMode = 'raw' | 'prediction'

const ALL_SOURCES = ['hot', 'cmems', 'ipacoa', 'dar_reef_check']

export function usePhData(years = 15) {
  const [mode, setMode] = useState<PhMode>('raw')
  const [selectedSources, setSelectedSources] = useState<string[]>(ALL_SOURCES)

  const [trendData, setTrendData] = useState<PhTrendPoint[]>([])
  const [prediction, setPrediction] = useState<PhPrediction | null>(null)
  const [sourceInfo, setSourceInfo] = useState<PhSourceInfo[]>([])

  const [loadingTrend, setLoadingTrend] = useState(false)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [predictionError, setPredictionError] = useState<string | null>(null)

  // Guards against concurrent in-flight requests
  const predictionFetchingRef = useRef(false)

  const fetchTrend = useCallback(() => {
    setLoadingTrend(true)
    setTrendError(null)
    api.getPhTrend(selectedSources, years)
      .then(setTrendData)
      .catch(e => setTrendError(e?.response?.data?.detail ?? 'Failed to load pH trend data'))
      .finally(() => setLoadingTrend(false))
  }, [selectedSources, years])

  const fetchPrediction = useCallback(() => {
    if (prediction || predictionFetchingRef.current) return
    predictionFetchingRef.current = true
    setLoadingPrediction(true)
    setPredictionError(null)
    api.getPhPrediction()
      .then(setPrediction)
      .catch(e => setPredictionError(e?.response?.data?.detail ?? 'Failed to load prediction'))
      .finally(() => {
        setLoadingPrediction(false)
        predictionFetchingRef.current = false
      })
  }, [prediction])

  useEffect(() => {
    api.getPhSources().then(setSourceInfo).catch(() => {})
  }, [])

  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  useEffect(() => {
    if (mode === 'prediction') fetchPrediction()
  }, [mode, fetchPrediction])

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    )
  }

  return {
    mode, setMode,
    selectedSources, toggleSource,
    trendData,
    prediction,
    sourceInfo,
    loadingTrend, loadingPrediction,
    trendError, predictionError,
  }
}

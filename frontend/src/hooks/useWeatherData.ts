import { useState, useEffect } from 'react'
import { api } from '../services/api'

export interface WeatherDay {
  date: string
  precip_mm: number | null
  rain_prob: number | null
  weather_code: number | null
  is_forecast: boolean
}

export interface WeatherGridPoint {
  name: string
  lat: number
  lon: number
  daily: WeatherDay[]
}

export interface WeatherGridData {
  grid: WeatherGridPoint[]
  fetched_at: string
}

export function useWeatherData(enabled: boolean) {
  const [data, setData] = useState<WeatherGridData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getWeatherGrid()
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message ?? 'Weather data unavailable') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled])

  return { data, loading, error }
}

export type WeatherTimeMode = 'today' | '7d' | '30d' | { dayIdx: number }

export function getPrecipForMode(point: WeatherGridPoint, mode: WeatherTimeMode): number {
  const hist = point.daily.filter(d => !d.is_forecast)
  if (mode === 'today') {
    const d = hist[hist.length - 1]
    return d?.precip_mm ?? 0
  }
  if (mode === '7d') {
    return hist.slice(-7).reduce((s, d) => s + (d.precip_mm ?? 0), 0)
  }
  if (mode === '30d') {
    return hist.reduce((s, d) => s + (d.precip_mm ?? 0), 0)
  }
  if (typeof mode === 'object') {
    return hist[mode.dayIdx]?.precip_mm ?? 0
  }
  return 0
}

export function getForecastProb(point: WeatherGridPoint, dayOffset: number): number {
  const forecast = point.daily.filter(d => d.is_forecast)
  return forecast[dayOffset]?.rain_prob ?? 0
}

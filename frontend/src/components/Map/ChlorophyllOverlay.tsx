import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type { ChlorophyllGrid } from '../../types'

interface Props {
  data: ChlorophyllGrid | null
  opacity?: number
}

// Color ramp: very low (deep blue) → medium (green) → high bloom (red)
function chlaToColor(val: number): [number, number, number] {
  // Typical open ocean: 0.01–0.5 mg/m³; bloom: 1–10+
  const t = Math.min(1, Math.log10(Math.max(0.01, val) + 1) / Math.log10(11))
  if (t < 0.25) {
    const r = t / 0.25
    return [Math.round(20 + r * 20), Math.round(100 + r * 100), Math.round(180 - r * 60)]
  } else if (t < 0.5) {
    const r = (t - 0.25) / 0.25
    return [Math.round(40 + r * 60), Math.round(200 - r * 40), Math.round(120 - r * 60)]
  } else if (t < 0.75) {
    const r = (t - 0.5) / 0.25
    return [Math.round(100 + r * 100), Math.round(160 - r * 80), Math.round(60 - r * 30)]
  } else {
    const r = (t - 0.75) / 0.25
    return [Math.round(200 + r * 55), Math.round(80 - r * 60), Math.round(30 - r * 20)]
  }
}

export function ChlorophyllOverlay({ data, opacity = 0.65 }: Props) {
  const map = useMap()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (!data || data.points.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L as typeof import('leaflet')
    if (!L) return

    // Remove previous overlay
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current)
      overlayRef.current = null
    }

    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Determine bounds from data
    const lats = data.points.map(p => p.lat)
    const lngs = data.points.map(p => p.lng)
    const latMin = Math.min(...lats)
    const latMax = Math.max(...lats)
    const lngMin = Math.min(...lngs)
    const lngMax = Math.max(...lngs)

    // Paint each point as a filled rectangle on the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const pt of data.points) {
      if (pt.chlorophyll == null) continue
      const x = Math.round(((pt.lng - lngMin) / (lngMax - lngMin)) * (canvas.width - 1))
      const y = Math.round(((latMax - pt.lat) / (latMax - latMin)) * (canvas.height - 1))
      const [r, g, b] = chlaToColor(pt.chlorophyll)
      ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`
      const cellW = Math.ceil(canvas.width / (lngs.filter((v, i, a) => a.indexOf(v) === i).length || 1)) + 2
      const cellH = Math.ceil(canvas.height / (lats.filter((v, i, a) => a.indexOf(v) === i).length || 1)) + 2
      ctx.fillRect(x - cellW / 2, y - cellH / 2, cellW, cellH)
    }

    const bounds: L.LatLngBoundsExpression = [[latMin, lngMin], [latMax, lngMax]]
    const layer = L.imageOverlay(canvas.toDataURL(), bounds, { opacity, interactive: false })
    layer.addTo(map)
    overlayRef.current = layer

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current)
        overlayRef.current = null
      }
    }
  }, [data, opacity, map])

  return null
}

interface LegendProps { visible: boolean }

export function ChlorophyllLegend({ visible }: LegendProps) {
  if (!visible) return null
  const stops = [
    { label: '< 0.1', color: 'rgb(20,130,160)' },
    { label: '0.5', color: 'rgb(60,180,90)' },
    { label: '1.0', color: 'rgb(160,120,30)' },
    { label: '> 5', color: 'rgb(240,30,10)' },
  ]
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow text-[10px] text-gray-700">
      <p className="font-semibold mb-1">Chlorophyll-a (mg/m³)</p>
      <div className="flex gap-1.5 items-center">
        {stops.map(s => (
          <span key={s.label} className="flex flex-col items-center gap-0.5">
            <span className="w-5 h-3 rounded-sm block" style={{ background: s.color }} />
            <span>{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

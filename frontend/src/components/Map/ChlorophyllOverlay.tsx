import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

interface Props {
  opacity?: number
}

// Hawaii bounding box used for both the overlay and the WMS request
const BOUNDS: L.LatLngBoundsExpression = [[17.5, -161.5], [23.5, -153.5]]
const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'

function gibsUrl(date: string): string {
  return (
    `${GIBS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=VIIRS_SNPP_L2_Chlorophyll_A` +
    `&CRS=CRS:84&BBOX=-161.5,17.5,-153.5,23.5` +
    `&WIDTH=900&HEIGHT=700&FORMAT=image%2Fpng&TRANSPARENT=true` +
    `&TIME=${date}`
  )
}

function targetDate(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 2)
  return d.toISOString().slice(0, 10)
}

export function ChlorophyllOverlay({ opacity = 0.7 }: Props) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    const layer = L.imageOverlay(gibsUrl(targetDate()), BOUNDS, {
      opacity,
      interactive: false,
      attribution: 'NASA GIBS · VIIRS Chl-a',
    })
    layer.addTo(map)
    layerRef.current = layer

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [opacity, map])

  return null
}

interface LegendProps { visible: boolean }

export function ChlorophyllLegend({ visible }: LegendProps) {
  if (!visible) return null
  // Color stops approximate the NASA GIBS ocean-color palette
  const stops = [
    { label: '< 0.1', color: 'rgb(68,1,84)' },
    { label: '0.3', color: 'rgb(59,82,139)' },
    { label: '1.0', color: 'rgb(33,145,140)' },
    { label: '3.0', color: 'rgb(94,201,98)' },
    { label: '> 10', color: 'rgb(253,231,37)' },
  ]
  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow text-[10px] text-gray-700 dark:text-slate-300">
      <p className="font-semibold mb-1">Chlorophyll-a (mg/m³)</p>
      <div className="flex gap-1 items-end">
        {stops.map(s => (
          <span key={s.label} className="flex flex-col items-center gap-0.5">
            <span className="w-5 h-3 rounded-sm block" style={{ background: s.color }} />
            <span>{s.label}</span>
          </span>
        ))}
      </div>
      <p className="text-gray-400 dark:text-slate-500 mt-1">NASA GIBS · VIIRS · {targetDate()}</p>
    </div>
  )
}

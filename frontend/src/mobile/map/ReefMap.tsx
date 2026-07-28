import { useEffect, useRef } from 'react'
import { createReefMap, type MapLayer, type MapSite } from './reefMapEngine'
import type { ReefSite } from '../../types'

// The engine's hand-placed geometry uses short design ids; map to/from the app's real site ids.
const SHORT_TO_FULL: Record<string, string> = {
  tunnels: 'tunnels-reef',
  poipu: 'poipu',
  sharks: 'sharks-cove',
  kaneohe: 'kaneohe-bay',
  hanauma: 'hanauma-bay',
  honolua: 'honolua-bay',
  molokini: 'molokini',
  kealakekua: 'kealakekua-bay',
  kona: 'kona-coast',
}
const FULL_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_TO_FULL).map(([short, full]) => [full, short])
)

export interface SelectedMapSite {
  id: string
  name: string
  color: string
  label: string
  sst: number | null
}

export function ReefMap({
  sites, layer, dark, onSelect, zoom, anchorY, centerX, centerY,
}: {
  sites: ReefSite[]
  layer: MapLayer
  dark: boolean
  onSelect: (site: SelectedMapSite | null) => void
  zoom?: number
  anchorY?: number
  centerX?: number
  centerY?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ReturnType<typeof createReefMap>>()
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = createReefMap(canvasRef.current, {
      layer, dark, zoom, anchorY, centerX, centerY,
      onSelect: (site: MapSite | null) => {
        onSelectRef.current(site ? { ...site, id: SHORT_TO_FULL[site.id] ?? site.id } : null)
      },
    })
    engineRef.current = engine
    return () => engine.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { engineRef.current?.setLayer(layer) }, [layer])
  useEffect(() => { engineRef.current?.setTheme(dark) }, [dark])

  useEffect(() => {
    if (!engineRef.current || sites.length === 0) return
    const dataById: Record<string, { color: string; label: string; sst: number | null }> = {}
    for (const s of sites) {
      const shortId = FULL_TO_SHORT[s.id]
      if (!shortId) continue
      dataById[shortId] = { color: s.alert?.color ?? '#16A34A', label: s.alert?.label ?? 'No stress', sst: s.sst_c }
    }
    engineRef.current.update(dataById)
  }, [sites])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}

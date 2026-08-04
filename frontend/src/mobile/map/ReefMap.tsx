import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { createReefMap, type MapLayer, type MapSite, type MapView } from './reefMapEngine'
import type { ReefSite } from '../../types'

// The engine's hand-placed geometry uses short design ids; map to/from the app's real site ids.
const SHORT_TO_FULL: Record<string, string> = {
  midway: 'midway-atoll',
  ffs: 'french-frigate',
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

export interface ReefMapHandle {
  zoomBy(factor: number): void
  resetView(): void
  fitAll(): void
  /** Centre on a site by its app-level id and select it. */
  focusSite(siteId: string, zoom?: number): void
}

interface Props {
  sites: ReefSite[]
  layer: MapLayer
  dark: boolean
  onSelect: (site: SelectedMapSite | null) => void
  onViewChange?: (view: MapView) => void
  zoom?: number
  anchorY?: number
  centerX?: number
  centerY?: number
}

export const ReefMap = forwardRef<ReefMapHandle, Props>(function ReefMap(
  { sites, layer, dark, onSelect, onViewChange, zoom, anchorY, centerX, centerY }, ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ReturnType<typeof createReefMap>>()
  const onSelectRef = useRef(onSelect)
  const onViewChangeRef = useRef(onViewChange)
  onSelectRef.current = onSelect
  onViewChangeRef.current = onViewChange

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = createReefMap(canvasRef.current, {
      layer, dark, zoom, anchorY, centerX, centerY,
      onSelect: (site: MapSite | null) => {
        onSelectRef.current(site ? { ...site, id: SHORT_TO_FULL[site.id] ?? site.id } : null)
      },
      onViewChange: (view: MapView) => onViewChangeRef.current?.(view),
    })
    engineRef.current = engine
    return () => engine.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    zoomBy: (factor: number) => engineRef.current?.zoomBy(factor),
    resetView: () => engineRef.current?.resetView(),
    fitAll: () => engineRef.current?.fitAll(),
    focusSite: (siteId: string, z?: number) => engineRef.current?.focusSite(FULL_TO_SHORT[siteId] ?? siteId, z),
  }), [])

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

  return (
    <canvas
      ref={canvasRef}
      // touchAction: none — the browser must not claim the pinch/drag before the engine sees it.
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    />
  )
})

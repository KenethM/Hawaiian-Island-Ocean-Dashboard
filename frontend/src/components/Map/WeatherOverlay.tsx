import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { WeatherGridData, WeatherGridPoint, WeatherTimeMode } from '../../hooks/useWeatherData'
import { getPrecipForMode, getForecastProb } from '../../hooks/useWeatherData'

// ─── Utilities ─────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, t), 3)
}

// ─── Color helpers ─────────────────────────────────────────────────────────

function precipRgb(mm: number): [number, number, number] {
  if (mm < 0.3) return [173, 216, 230]
  if (mm < 1)   return [0, 191, 255]
  if (mm < 3)   return [30, 144, 255]
  if (mm < 8)   return [0, 80, 220]
  if (mm < 18)  return [100, 0, 200]
  if (mm < 40)  return [180, 0, 130]
  return              [220, 30, 50]
}

function precipAlpha(mm: number): number {
  if (mm < 0.3) return 0.25
  if (mm < 1)   return 0.38
  if (mm < 3)   return 0.52
  if (mm < 8)   return 0.62
  if (mm < 18)  return 0.70
  if (mm < 40)  return 0.75
  return              0.82
}

function probRgb(pct: number): [number, number, number] {
  if (pct < 20) return [200, 230, 150]
  if (pct < 40) return [144, 238, 144]
  if (pct < 60) return [255, 215, 0]
  if (pct < 75) return [255, 140, 0]
  return              [220, 20, 60]
}

function probAlpha(pct: number): number {
  if (pct < 20) return 0.18
  if (pct < 40) return 0.35
  if (pct < 60) return 0.52
  if (pct < 75) return 0.65
  return              0.75
}

// ─── Heatmap canvas layer ──────────────────────────────────────────────────
//
// The canvas is placed DIRECTLY in map.getContainer() (not inside any pane).
// This sidesteps all pane-transform issues:
//   • map.getContainer() never receives CSS transforms during pan or zoom
//   • map.latLngToContainerPoint() always returns coordinates relative to the
//     container top-left, so drawing at (cp.x, cp.y) is always correct
//   • No setPosition(), no zoomanim handler, no pane-offset math needed
//
// z-index 450 sits above overlayPane (400) but below shadowPane (500) so
// markers/popups still render on top of the weather overlay.

interface CanvasLayerOptions {
  grid: WeatherGridPoint[]
  mode: WeatherTimeMode
  showForecast: boolean
  forecastDay: number
  opacity: number
}

class WeatherCanvasLayer extends L.Layer {
  private _canvas: HTMLCanvasElement
  private _map: L.Map | null = null
  private _opts: CanvasLayerOptions
  private _fromVals: number[] = []
  private _toVals: number[] = []
  private _lerpProgress = 1
  private _lerpStart = 0
  private readonly _LERP_MS = 380
  private _raf = 0

  constructor(opts: CanvasLayerOptions) {
    super()
    this._opts = opts
    this._canvas = document.createElement('canvas')
    this._canvas.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;z-index:450;'
  }

  onAdd(map: L.Map): this {
    this._map = map
    map.getContainer().appendChild(this._canvas)
    map.on('move',      this._onMove,      this)
    map.on('moveend',   this._onMoveEnd,   this)
    map.on('zoomstart', this._onZoomStart, this)
    map.on('zoomend',   this._onZoomEnd,   this)
    map.on('resize',    this._onResize,    this)
    this._syncCanvas()
    return this
  }

  onRemove(map: L.Map): this {
    map.getContainer().removeChild(this._canvas)
    map.off('move',      this._onMove,      this)
    map.off('moveend',   this._onMoveEnd,   this)
    map.off('zoomstart', this._onZoomStart, this)
    map.off('zoomend',   this._onZoomEnd,   this)
    map.off('resize',    this._onResize,    this)
    this._map = null
    cancelAnimationFrame(this._raf)
    this._raf = 0
    return this
  }

  update(opts: CanvasLayerOptions) {
    const oldVals = this._getValues(this._opts)
    const newVals = this._getValues(opts)
    const changed = newVals.some((v, i) => Math.abs(v - (oldVals[i] ?? 0)) > 0.1)
    this._opts = opts
    if (changed) {
      this._fromVals = oldVals
      this._toVals   = newVals
      this._lerpProgress = 0
      this._lerpStart    = performance.now()
      this._runLerpRAF()
    } else {
      this._syncCanvas()
    }
  }

  private _getValues(opts: CanvasLayerOptions): number[] {
    return opts.grid.map(p =>
      opts.showForecast
        ? getForecastProb(p, opts.forecastDay)
        : getPrecipForMode(p, opts.mode)
    )
  }

  // Draw synchronously inside Leaflet's own RAF (move fires from within it),
  // so canvas and tiles update in the same browser frame — no 1-frame lag.
  private _onMove = () => { if (this._map) this._drawFrame() }

  // Final redraw after Leaflet settles pixelOrigin on pan end / inertia end.
  private _onMoveEnd = () => { if (this._map) this._syncCanvas() }

  private _onZoomStart = () => { this._canvas.style.opacity = '0' }

  private _onZoomEnd = () => {
    this._canvas.style.opacity = '1'
    this._syncCanvas()
  }

  private _onResize = () => { this._syncCanvas() }

  private _resize() {
    const map = this._map!
    const size = map.getSize()
    if (this._canvas.width  !== size.x) this._canvas.width  = size.x
    if (this._canvas.height !== size.y) this._canvas.height = size.y
    // No setPosition — canvas is always pinned to container top-left via CSS
  }

  private _syncCanvas() {
    if (!this._map) return
    this._resize()
    this._drawFrame()
  }

  private _runLerpRAF() {
    cancelAnimationFrame(this._raf)
    const tick = () => {
      if (!this._map) { this._raf = 0; return }
      this._lerpProgress = Math.min(1, (performance.now() - this._lerpStart) / this._LERP_MS)
      this._syncCanvas()
      this._raf = this._lerpProgress < 1 ? requestAnimationFrame(tick) : 0
    }
    this._raf = requestAnimationFrame(tick)
  }

  private _drawFrame() {
    const map = this._map!
    const ctx  = this._canvas.getContext('2d')!
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)

    const zoom       = map.getZoom()
    const baseRadius = Math.max(50, 280 - zoom * 22)
    const t          = easeOutCubic(this._lerpProgress)
    const { grid, opacity, showForecast } = this._opts
    const lerping    = this._lerpProgress < 1 && this._fromVals.length === grid.length

    for (let i = 0; i < grid.length; i++) {
      const pt  = grid[i]
      const raw = showForecast
        ? getForecastProb(pt, this._opts.forecastDay)
        : getPrecipForMode(pt, this._opts.mode)
      const value = lerping
        ? lerp(this._fromVals[i] ?? raw, this._toVals[i] ?? raw, t)
        : raw
      if (showForecast ? value < 5 : value < 0.05) continue

      const [r, g, b] = showForecast ? probRgb(value) : precipRgb(value)
      const baseA     = (showForecast ? probAlpha(value) : precipAlpha(value)) * opacity

      // latLngToContainerPoint → pixel relative to container top-left.
      // Canvas is also at container top-left, so these are direct canvas coords.
      const cp = map.latLngToContainerPoint(L.latLng(pt.lat, pt.lon))

      const grad = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, baseRadius)
      grad.addColorStop(0,    `rgba(${r},${g},${b},${Math.min(1, baseA).toFixed(3)})`)
      grad.addColorStop(0.45, `rgba(${r},${g},${b},${Math.min(1, baseA * 0.5).toFixed(3)})`)
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cp.x, cp.y, baseRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ─── Radar-ring ripple layer (60 fps RAF) ──────────────────────────────────
//
// Same container approach as the heatmap.  Because latLngToContainerPoint()
// is updated by Leaflet in real time during panning, the RAF loop always draws
// rings at the correct screen position without any extra offset math.

interface RipplePoint {
  lat: number
  lon: number
  rgb: [number, number, number]
  intensity: number
}

const RING_PERIOD = 2600

class RippleLayer extends L.Layer {
  private _canvas: HTMLCanvasElement
  private _map: L.Map | null = null
  private _raf = 0
  private _t0 = 0
  private _points: RipplePoint[] = []
  private _zooming = false

  constructor() {
    super()
    this._canvas = document.createElement('canvas')
    this._canvas.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;z-index:451;'
  }

  onAdd(map: L.Map): this {
    this._map = map
    map.getContainer().appendChild(this._canvas)
    map.on('move',      this._onMove,      this)
    map.on('resize',    this._onResize,    this)
    map.on('zoomstart', this._onZoomStart, this)
    map.on('zoomend',   this._onZoomEnd,   this)
    this._onResize()
    this._t0 = performance.now()
    this._startRAF()
    return this
  }

  onRemove(map: L.Map): this {
    map.getContainer().removeChild(this._canvas)
    map.off('move',      this._onMove,      this)
    map.off('resize',    this._onResize,    this)
    map.off('zoomstart', this._onZoomStart, this)
    map.off('zoomend',   this._onZoomEnd,   this)
    this._map = null
    cancelAnimationFrame(this._raf)
    this._raf = 0
    return this
  }

  private _onMove = () => {
    if (this._map && !this._zooming) this._draw(performance.now() - this._t0)
  }

  setPoints(grid: WeatherGridPoint[], mode: WeatherTimeMode, showForecast: boolean, forecastDay: number) {
    this._points = []
    for (const pt of grid) {
      let value: number, rgb: [number, number, number], threshold: number
      if (showForecast) {
        value = getForecastProb(pt, forecastDay)
        threshold = 58
        rgb = value > 82 ? [220, 20, 60] : value > 68 ? [255, 100, 0] : [255, 195, 0]
      } else {
        value = getPrecipForMode(pt, mode)
        threshold = 5
        rgb = value > 30 ? [220, 30, 50] : value > 14 ? [140, 0, 210] : [30, 80, 220]
      }
      if (value < threshold) continue
      const intensity = Math.min(1, (value - threshold) / (threshold * 4))
      this._points.push({ lat: pt.lat, lon: pt.lon, rgb, intensity })
    }
  }

  private _onResize = () => {
    const map = this._map
    if (!map) return
    const size = map.getSize()
    this._canvas.width  = size.x
    this._canvas.height = size.y
  }

  private _onZoomStart = () => {
    this._zooming = true
    this._canvas.style.opacity = '0'
  }

  private _onZoomEnd = () => {
    this._zooming = false
    this._canvas.style.opacity = '1'
    this._onResize()
  }

  private _startRAF() {
    cancelAnimationFrame(this._raf)
    const tick = () => {
      if (!this._map) return
      if (!this._zooming) {
        this._draw(performance.now() - this._t0)
      }
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  private _draw(elapsed: number) {
    const map = this._map!
    const ctx  = this._canvas.getContext('2d')!
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)

    const zoom = map.getZoom()
    const maxR = Math.max(18, 72 - zoom * 5)

    for (const pt of this._points) {
      const cp     = map.latLngToContainerPoint(L.latLng(pt.lat, pt.lon))
      const [r, g, b] = pt.rgb
      const ptMaxR = maxR * (0.85 + pt.intensity * 0.3)

      for (let ring = 0; ring < 3; ring++) {
        const phase  = ((elapsed + ring * (RING_PERIOD / 3)) % RING_PERIOD) / RING_PERIOD
        const radius = phase * ptMaxR
        const alpha  = (1 - phase) * 0.72 * (0.55 + pt.intensity * 0.45)
        if (alpha < 0.015 || radius < 0.5) continue

        ctx.beginPath()
        ctx.arc(cp.x, cp.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
        ctx.lineWidth   = 1 + (1 - phase) * 2.5
        ctx.stroke()
      }

      const breath = 0.78 + 0.22 * Math.sin(elapsed / 900 + pt.lat)
      ctx.beginPath()
      ctx.arc(cp.x, cp.y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r},${g},${b},${(breath * (0.7 + pt.intensity * 0.3)).toFixed(3)})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cp.x - 1, cp.y - 1, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${(breath * 0.6).toFixed(2)})`
      ctx.fill()
    }
  }
}

// ─── React wrappers ────────────────────────────────────────────────────────

interface LayerProps {
  grid: WeatherGridPoint[]
  mode: WeatherTimeMode
  showForecast: boolean
  forecastDay: number
  opacity: number
}

function WeatherCanvasRenderer({ grid, mode, showForecast, forecastDay, opacity }: LayerProps) {
  const map = useMap()
  const layerRef = useRef<WeatherCanvasLayer | null>(null)

  useEffect(() => {
    const layer = new WeatherCanvasLayer({ grid, mode, showForecast, forecastDay, opacity })
    layer.addTo(map)
    layerRef.current = layer
    return () => { layer.remove() }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    layerRef.current?.update({ grid, mode, showForecast, forecastDay, opacity })
  }, [map, grid, mode, showForecast, forecastDay, opacity]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function RippleRenderer({ grid, mode, showForecast, forecastDay }: Omit<LayerProps, 'opacity'>) {
  const map = useMap()
  const layerRef = useRef<RippleLayer | null>(null)

  useEffect(() => {
    const layer = new RippleLayer()
    layer.addTo(map)
    layerRef.current = layer
    return () => { layer.remove() }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    layerRef.current?.setPoints(grid, mode, showForecast, forecastDay)
  }, [grid, mode, showForecast, forecastDay])

  return null
}

// ─── Control Panel ─────────────────────────────────────────────────────────

export interface WeatherControlState {
  enabled: boolean
  showForecast: boolean
  forecastDay: number
  mode: WeatherTimeMode
  opacity: number
  animating: boolean
  animDay: number
}

interface ControlPanelProps {
  state: WeatherControlState
  histDays: number
  loading: boolean
  error: string | null
  onChange: (patch: Partial<WeatherControlState>) => void
  onTickDay: (next: number) => void
}

export function WeatherControlPanel({ state, histDays, loading, error, onChange, onTickDay }: ControlPanelProps) {
  const { enabled, showForecast, forecastDay, mode, opacity, animating, animDay } = state

  useEffect(() => {
    if (!animating) return
    const id = setInterval(() => {
      onTickDay(animDay + 1 >= histDays ? 0 : animDay + 1)
    }, 450)
    return () => clearInterval(id)
  }, [animating, histDays, animDay, onTickDay])

  const modeLabel = showForecast
    ? `Forecast +${forecastDay + 1}d`
    : mode === 'today' ? 'Today'
    : mode === '7d'    ? '7-Day Total'
    : mode === '30d'   ? '30-Day Total'
    : `Day ${(mode as { dayIdx: number }).dayIdx + 1}`

  return (
    <div className="absolute top-4 right-4 z-[1000] select-none" style={{ minWidth: 220 }}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange({ enabled: !enabled })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border transition-all duration-200 ${
            enabled
              ? 'bg-sky-600 border-sky-400 text-white'
              : 'bg-slate-800/90 border-slate-600 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="text-base leading-none">🌧</span>
          <span>Weather{enabled ? ' On' : ' Off'}</span>
          {loading && <span className="ml-1 animate-spin text-xs">⟳</span>}
        </button>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-400 leading-none">
          Experimental
        </span>
      </div>

      {enabled && (
        <div className="mt-2 bg-slate-900/95 border border-slate-600 rounded-xl shadow-2xl text-xs text-slate-200 overflow-hidden backdrop-blur-sm">
          <div className="px-3 py-2 bg-slate-800/70 border-b border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-sky-300 text-[11px] uppercase tracking-wider">Weather Overlay</span>
            <span className="text-slate-400 text-[10px]">{modeLabel}</span>
          </div>

          {error && <div className="px-3 py-2 text-red-400 text-[10px]">{error}</div>}

          <div className="flex border-b border-slate-700">
            {(['History', 'Forecast'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => onChange({ showForecast: tab === 'Forecast', animating: false })}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  (tab === 'Forecast') === showForecast
                    ? 'bg-sky-700/50 text-sky-200'
                    : 'text-slate-400 hover:bg-slate-700/40'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="px-3 py-2.5 space-y-3">
            {!showForecast && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Time Range</p>
                <div className="grid grid-cols-3 gap-1">
                  {(['today', '7d', '30d'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => onChange({ mode: m, animating: false })}
                      className={`py-1 rounded text-[10px] font-medium transition-colors ${
                        mode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {m === 'today' ? 'Today' : m === '7d' ? '7-Day' : '30-Day'}
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => onChange({ animating: !animating })}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      animating ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {animating ? '⏹ Stop' : '▶ Animate'}
                  </button>
                  <span className="text-slate-500 text-[10px]">30-day replay</span>
                </div>

                {(animating || typeof mode === 'object') && (
                  <div className="mt-1.5">
                    <input
                      type="range"
                      min={0} max={histDays - 1}
                      value={animating ? animDay : (typeof mode === 'object' ? mode.dayIdx : histDays - 1)}
                      onChange={e => onChange({ animating: false, mode: { dayIdx: Number(e.target.value) } })}
                      className="w-full accent-sky-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                      <span>30 days ago</span><span>Today</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showForecast && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Forecast Day</p>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: 7 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => onChange({ forecastDay: i })}
                      className={`py-1 rounded text-[9px] font-medium transition-colors ${
                        forecastDay === i ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      +{i + 1}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">Rain probability — shown as heat overlay</p>
              </div>
            )}

            <div>
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
                Intensity · {Math.round(opacity * 100)}%
              </p>
              <input
                type="range" min={0.2} max={1} step={0.05} value={opacity}
                onChange={e => onChange({ opacity: Number(e.target.value) })}
                className="w-full accent-sky-500 h-1"
              />
            </div>
          </div>

          <div className="px-3 pb-2.5">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
              {showForecast ? 'Rain Probability' : 'Rainfall (mm)'}
            </p>
            {showForecast ? (
              <div className="flex gap-1 flex-wrap">
                {[['<20%','#90ee90'],['20-40%','#ffd700'],['40-60%','#ff8c00'],['60-75%','#ff4500'],['>75%','#dc2626']].map(([l,c]) => (
                  <span key={l} className="flex items-center gap-1 text-[9px]">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />{l}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex gap-1 flex-wrap">
                {[['Trace','#add8e6'],['1mm','#00bfff'],['3mm','#1e90ff'],['8mm','#0050dc'],['18mm','#6400c8'],['40+','#b40082']].map(([l,c]) => (
                  <span key={l} className="flex items-center gap-1 text-[9px]">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />{l}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 pb-2 text-[9px] text-slate-500 border-t border-slate-700 pt-1.5">
            Source: Open-Meteo · 25 grid points across Hawaiian Islands
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Public composite ──────────────────────────────────────────────────────

interface WeatherOverlayProps {
  data: WeatherGridData | null
  state: WeatherControlState
}

export function WeatherOverlay({ data, state }: WeatherOverlayProps) {
  if (!data || !state.enabled) return null

  const { mode, showForecast, forecastDay, opacity, animating, animDay } = state
  const resolvedMode: WeatherTimeMode = animating ? { dayIdx: animDay } : mode

  return (
    <>
      <WeatherCanvasRenderer
        grid={data.grid} mode={resolvedMode}
        showForecast={showForecast} forecastDay={forecastDay} opacity={opacity}
      />
      <RippleRenderer
        grid={data.grid} mode={resolvedMode}
        showForecast={showForecast} forecastDay={forecastDay}
      />
    </>
  )
}

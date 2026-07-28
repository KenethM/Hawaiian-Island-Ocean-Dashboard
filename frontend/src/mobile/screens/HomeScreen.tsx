import { useMemo, useState } from 'react'
import { ReefMap, type SelectedMapSite } from '../map/ReefMap'
import type { MapLayer } from '../map/reefMapEngine'
import { SegmentedControl } from '../components/SegmentedControl'
import { SectionDivider } from '../components/SectionDivider'
import { DraggableSheet } from '../components/DraggableSheet'
import { useWeatherData, getPrecipForMode } from '../../hooks/useWeatherData'
import { useReefPulseExtras } from '../hooks/useReefPulseExtras'
import type { ReefSite } from '../../types'

function moonPhase(): { label: string; pct: number } {
  // Simple synodic-month approximation (29.530588853 days) from a known new moon.
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14)
  const days = (Date.now() - knownNewMoon) / 86_400_000
  const age = days % 29.530588853
  const pct = Math.round((age < 14.765 ? age / 14.765 : (29.530588853 - age) / 14.765) * 100)
  let label = 'New moon'
  if (age < 1.8) label = 'New moon'
  else if (age < 6.4) label = 'Waxing crescent'
  else if (age < 8.3) label = 'First quarter'
  else if (age < 13.8) label = 'Waxing gibbous'
  else if (age < 15.8) label = 'Full moon'
  else if (age < 21.3) label = 'Waning gibbous'
  else if (age < 23.3) label = 'Last quarter'
  else if (age < 28) label = 'Waning crescent'
  return { label, pct }
}

function weatherLabel(code: number | null): string {
  if (code == null) return '—'
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly sun'
  if (code === 3) return 'Overcast'
  if (code >= 51 && code <= 67) return 'Showers'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95) return 'Storms'
  return 'Fair'
}

const SEGMENTS: { value: MapLayer; label: string }[] = [
  { value: 'reef', label: 'Reef' },
  { value: 'weather', label: 'Weather' },
  { value: 'currents', label: 'Currents' },
  { value: 'life', label: 'Life' },
]

// Sheet sizing — kept in sync with the numbers passed to <DraggableSheet> below so the
// greeting/segmented-control animations track the sheet's real height as it's dragged.
const SHEET_PEEK = 64
const SHEET_DEFAULT = 340
const SHEET_EXPANDED_FRACTION = 0.78
const SEGMENTED_TOP_EXPANDED = 20
const SEGMENTED_TOP_DEFAULT = 148

export function HomeScreen({
  sites, dark, onOpenSite,
}: {
  sites: ReefSite[]
  dark: boolean
  onOpenSite: (siteId: string) => void
}) {
  const [layer, setLayer] = useState<MapLayer>('reef')
  const [selected, setSelected] = useState<SelectedMapSite | null>(null)
  const [sheetHeight, setSheetHeight] = useState(SHEET_DEFAULT)
  const moon = useMemo(moonPhase, [])
  const { data: weather } = useWeatherData(layer === 'weather')
  const { tide, clearestM } = useReefPulseExtras(sites)

  const avgSst = useMemo(() => {
    const vals = sites.map(s => s.sst_c).filter((v): v is number => v != null)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  }, [sites])

  const watchCount = sites.filter(s => s.alert && s.alert.level >= 1).length
  const needsAttention = sites
    .filter(s => s.alert && s.alert.level >= 1)
    .sort((a, b) => b.alert.level - a.alert.level)
    .slice(0, 4)

  const todayStrip = useMemo(() => {
    if (!weather?.grid?.length) return null
    const point = weather.grid[0]
    const hist = point.daily.filter(d => !d.is_forecast)
    const forecast = point.daily.filter(d => d.is_forecast)
    const days = [
      { label: 'Today', code: hist[hist.length - 1]?.weather_code ?? null },
      { label: 'Tomorrow', code: forecast[0]?.weather_code ?? null },
      { label: 'Day after', code: forecast[1]?.weather_code ?? null },
    ]
    const rain7d = point.daily.filter(d => !d.is_forecast).slice(-7).reduce((s, d) => s + (d.precip_mm ?? 0), 0)
    return { days, rain7d: getPrecipForMode(point, '7d') || rain7d }
  }, [weather])

  // As the sheet is dragged past its default height, fade/slide the greeting out of the way —
  // past that point the user is reading the sheet, not the date/moon/tide chips.
  const expandedMaxHeight = typeof window !== 'undefined' ? window.innerHeight * SHEET_EXPANDED_FRACTION : SHEET_DEFAULT * 2
  const collapseProgress = Math.min(1, Math.max(0, (sheetHeight - SHEET_DEFAULT) / (expandedMaxHeight - SHEET_DEFAULT)))
  const segmentedTop = SEGMENTED_TOP_DEFAULT - (SEGMENTED_TOP_DEFAULT - SEGMENTED_TOP_EXPANDED) * collapseProgress

  return (
    <div className="relative h-full overflow-hidden">
      <ReefMap
        sites={sites} layer={layer} dark={dark} onSelect={setSelected}
        zoom={1.05} anchorY={0.40} centerX={584} centerY={330}
      />

      {/* top scrim + greeting — fades and slides up once the sheet is dragged past default,
          since at that point the user is reading the sheet, not the general greeting */}
      <div
        className="absolute top-0 left-0 right-0 h-[190px] pointer-events-none z-[2]"
        style={{
          background: 'linear-gradient(to bottom, rgba(11,44,55,0.66), rgba(11,44,55,0.3) 55%, rgba(11,44,55,0))',
          opacity: 1 - collapseProgress,
          transition: 'opacity 0.18s ease',
        }}
      />
      <div
        className="relative z-[2] px-5 pt-3 pointer-events-none"
        style={{ opacity: 1 - collapseProgress, transform: `translateY(${-16 * collapseProgress}px)`, transition: 'opacity 0.18s ease, transform 0.18s ease' }}
      >
        <div className="text-[12px] font-bold tracking-[0.16em] uppercase" style={{ color: '#c9efd6' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <h2 className="serif mt-1 text-[29px] font-medium text-white" style={{ textShadow: '0 1px 12px rgba(8,40,52,0.5)' }}>
          Today on the reef
        </h2>
        <div className="flex gap-2 mt-3">
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(15,41,52,0.42)', backdropFilter: 'blur(6px)' }}>
            <span className="text-[12px] text-white font-medium">🌔 {moon.label} · {moon.pct}%</span>
          </div>
          {tide && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(15,41,52,0.42)', backdropFilter: 'blur(6px)' }}>
              <span className="text-[12px] text-white font-medium">
                {tide.state === 'rising' ? '↝' : '↜'} Tide {tide.state} · {tide.heightFt.toFixed(1)} ft
              </span>
            </div>
          )}
        </div>
      </div>

      {/* segmented layer control — glides up to reclaim the space the greeting vacates */}
      <div className="absolute left-4 right-4 z-[3]" style={{ top: segmentedTop, transition: 'top 0.18s ease' }}>
        <SegmentedControl options={SEGMENTS} value={layer} onChange={setLayer} tone="dark" />
      </div>

      {/* frosted bottom sheet — drag the handle to peek/expand, or tap it to cycle */}
      <DraggableSheet
        bottomOffset="calc(86px + env(safe-area-inset-bottom))"
        peekHeight={SHEET_PEEK}
        defaultHeight={SHEET_DEFAULT}
        expandedFraction={SHEET_EXPANDED_FRACTION}
        onHeightChange={setSheetHeight}
      >
        {selected && (
          <button
            onClick={() => onOpenSite(selected.id)}
            className="w-full flex items-center gap-3 rounded-2xl border px-4 py-3 mb-4 text-left"
            style={{ background: 'var(--k-bg)', borderColor: 'var(--k-border)' }}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: selected.color }} />
            <div className="flex-1">
              <div className="serif text-[17px]" style={{ color: 'var(--k-ink)' }}>{selected.name}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--k-sub)' }}>
                {selected.label}{selected.sst != null ? ` · ${selected.sst.toFixed(1)}°C sea temp` : ''}
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        )}

        {layer === 'reef' && (
          <div>
            <SectionDivider label="Reef pulse" />
            <div className="flex gap-2.5 mb-3.5">
              <div className="flex-1 text-center">
                <div className="serif text-[24px]" style={{ color: 'var(--k-ink)' }}>{avgSst}°</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Avg sea temp</div>
              </div>
              <div className="w-px" style={{ background: 'var(--k-hair)' }} />
              <div className="flex-1 text-center">
                <div className="serif text-[24px]" style={{ color: '#F59E0B' }}>{watchCount}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Watch alerts</div>
              </div>
              <div className="w-px" style={{ background: 'var(--k-hair)' }} />
              <div className="flex-1 text-center">
                <div className="serif text-[24px]" style={{ color: '#0f766e' }}>{clearestM != null ? `${clearestM.toFixed(0)} m` : '—'}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Clearest water</div>
              </div>
            </div>
            {needsAttention.length > 0 ? (
              <div className="rounded-2xl border p-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                <div className="text-[12px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: '#DC2626' }}>Needs attention</div>
                <div className="text-[13.5px] leading-[1.7]" style={{ color: 'var(--k-ink2)' }}>
                  {needsAttention.map((s, i) => (
                    <span key={s.id}>{s.name} — {s.alert.label.toLowerCase()}{i < needsAttention.length - 1 ? <br /> : null}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-[12.5px] py-2" style={{ color: 'var(--k-sub)' }}>All monitored reefs are clear right now.</div>
            )}
            {!selected && (
              <div className="text-center text-[12.5px] pt-3 pb-0.5" style={{ color: 'var(--k-sub)' }}>Tap a reef on the map to see its conditions</div>
            )}
          </div>
        )}

        {layer === 'weather' && (
          <div>
            <h3 className="serif text-[19px] mb-0.5" style={{ color: 'var(--k-ink)' }}>Weather passing through</h3>
            <p className="text-[13px] mb-3.5" style={{ color: 'var(--k-sub)' }}>Live 3-day outlook for the island chain.</p>
            {todayStrip ? (
              <>
                <div className="flex gap-2.5 mb-3.5">
                  {todayStrip.days.map((d, i) => (
                    <div key={i} className="flex-1 rounded-2xl border py-3 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                      <div className="text-[12px]" style={{ color: 'var(--k-sub)' }}>{d.label}</div>
                      <div className="serif text-[16px] mt-0.5" style={{ color: 'var(--k-ink)' }}>{weatherLabel(d.code)}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border px-4 py-3 text-[13.5px] leading-[1.7]" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)', color: 'var(--k-ink2)' }}>
                  {todayStrip.rain7d.toFixed(1)} mm rain across the chain this week — runoff may cloud nearshore water after heavier showers.
                </div>
              </>
            ) : (
              <div className="text-center text-[12.5px] py-4" style={{ color: 'var(--k-sub)' }}>Loading weather…</div>
            )}
          </div>
        )}

        {layer === 'currents' && (
          <div>
            <h3 className="serif text-[19px] mb-0.5" style={{ color: 'var(--k-ink)' }}>Ocean currents</h3>
            <p className="text-[13px] mb-3.5" style={{ color: 'var(--k-sub)' }}>Surface flow sweeping northwest along the island chain.</p>
            <div className="flex gap-2.5 mb-3.5">
              {[['Set', 'NW ↖'], ['Drift', '0.4 kt'], ['Clarity', clearestM != null ? `${clearestM.toFixed(0)} m` : '—']].map(([k, v]) => (
                <div key={k} className="flex-1 rounded-2xl border py-3 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                  <div className="text-[12px]" style={{ color: 'var(--k-sub)' }}>{k}</div>
                  <div className="serif text-[16px] mt-0.5" style={{ color: '#0f766e' }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border px-4 py-3 text-[13.5px] leading-[1.7]" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)', color: 'var(--k-ink2)' }}>
              Channel currents run stronger on the outgoing tide — plan drift dives accordingly.
            </div>
          </div>
        )}

        {layer === 'life' && (
          <div>
            <h3 className="serif text-[19px] mb-0.5" style={{ color: 'var(--k-ink)' }}>Life on the water</h3>
            <p className="text-[13px] mb-3.5" style={{ color: 'var(--k-sub)' }}>Wildlife moving across the map right now.</p>
            <div className="flex flex-col gap-2">
              {[
                ['#334155', 'Humpback whales', 'A cow-calf pair crossing the open channel.'],
                ['#475569', 'Spinner dolphins', 'A pod leaping in the bay south of Oahu.'],
                ['#15803D', 'Green sea turtle', 'Grazing the reef flat off Maui.'],
                ['#3f2d1e', 'Outrigger canoe', 'A crew paddling the channel toward Oahu.'],
              ].map(([color, title, desc]) => (
                <div key={title} className="flex gap-3 items-start rounded-2xl border px-3.5 py-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
                  <div>
                    <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>{title}</div>
                    <div className="serif text-[13px] mt-0.5" style={{ color: 'var(--k-ink2)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DraggableSheet>
    </div>
  )
}

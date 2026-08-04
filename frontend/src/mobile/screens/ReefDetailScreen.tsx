import { useEffect, useMemo, useState } from 'react'
import { SectionDivider } from '../components/SectionDivider'
import { SegmentedControl } from '../components/SegmentedControl'
import { TempTrendChart } from '../../components/Charts/TempTrendChart'
import { SstYoYChart } from '../../components/Charts/SstYoYChart'
import { DhwForecastChart } from '../../components/Charts/DhwForecastChart'
import { useOceanConditions } from '../../hooks/useOceanConditions'
import { useSstHistory } from '../../hooks/useSstHistory'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { ReefSite, ClarityDay } from '../../types'
import type { DiverLogWithCoords } from '../../hooks/useDiverLogs'

type DetailTab = 'now' | 'temperature'

const DETAIL_TABS: { value: DetailTab; label: string }[] = [
  { value: 'now', label: 'Right now' },
  { value: 'temperature', label: 'Temperature' },
]

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <div style={{ height: 20 }} />
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const path = points
    .map((v, i) => `${(i / (points.length - 1)) * 90},${18 - ((v - min) / range) * 16}`)
    .join(' ')
  return (
    <svg viewBox="0 0 90 24" style={{ width: '100%', height: 20, marginTop: 4 }}>
      <polyline points={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ReefDetailScreen({
  site, sites, diverLogs, onBack, onSelectSite, onSignInClick,
}: {
  site: ReefSite
  sites: ReefSite[]
  diverLogs: DiverLogWithCoords[]
  onBack: () => void
  onSelectSite: (siteId: string) => void
  onSignInClick: () => void
}) {
  const { user } = useAuth()
  const conditions = useOceanConditions(site.id)
  const { history } = useSstHistory(site.id, 10)
  const [tab, setTab] = useState<DetailTab>('now')
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)

  // Sites are cycled in the order the map/API lists them, grouped by island so
  // stepping through feels like moving along the chain rather than jumping around.
  const ordered = useMemo(
    () => [...sites].sort((a, b) => a.island.localeCompare(b.island) || a.name.localeCompare(b.name)),
    [sites]
  )
  const idx = ordered.findIndex(s => s.id === site.id)
  const prevSite = ordered.length > 1 && idx >= 0 ? ordered[(idx - 1 + ordered.length) % ordered.length] : null
  const nextSite = ordered.length > 1 && idx >= 0 ? ordered[(idx + 1) % ordered.length] : null

  useEffect(() => {
    if (!user) { setSubscribed(false); return }
    api.getSubscriptions().then(subs => setSubscribed(subs.some(s => s.reef_site_id === site.id))).catch(() => {})
  }, [user, site.id])

  // A new site means new data — don't leave the reader parked on a chart for the old reef.
  useEffect(() => { setTab('now') }, [site.id])

  async function toggleAlert() {
    if (!user) { onSignInClick(); return }
    setSubLoading(true)
    try {
      if (subscribed) { await api.unsubscribe(site.id); setSubscribed(false) }
      else { await api.subscribe(site.id); setSubscribed(true) }
    } finally {
      setSubLoading(false)
    }
  }

  const recentHere = diverLogs.filter(l => l.reef_site_id === site.id).slice(0, 3)
  const sstPoints = history?.readings?.map(r => r.sst_c) ?? []
  const waves = conditions.waves?.data
  const tides = conditions.tides

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-shrink-0 px-5 pb-4"
        style={{ background: 'var(--k-panel)', borderRadius: '0 0 22px 22px' }}
      >
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={onBack} aria-label="Back to map" className="flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div className="min-w-0">
              <div className="serif text-[22px] text-white truncate">{site.name}</div>
              <div className="text-[12px]" style={{ color: 'var(--k-faint)' }}>{site.island} · {site.depth_m} m depth</div>
            </div>
          </div>
          <button
            onClick={toggleAlert}
            disabled={subLoading}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
            style={{ background: subscribed ? '#15803D' : 'rgba(255,255,255,0.12)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            {subscribed ? 'Following' : 'Alert me'}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3.5">
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{ background: `${site.alert.color}33`, color: '#fff' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: site.alert.color }} />
            {site.alert.label}
          </span>
          {site.sst_c != null && (
            <span className="text-[12px]" style={{ color: 'var(--k-faint)' }}>
              {site.sst_c.toFixed(1)}°C · MMM {site.mmm_c}°C
            </span>
          )}
        </div>

        {/* Step along the chain without going back to the map first. */}
        {prevSite && nextSite && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onSelectSite(prevSite.id)}
              className="flex items-center gap-1 min-w-0 flex-1 rounded-full pl-2 pr-3 py-1.5"
              style={{ background: 'rgba(255,255,255,0.09)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><path d="M15 6l-6 6 6 6" /></svg>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: prevSite.alert.color }} />
              <span className="truncate text-[11.5px] text-white/85">{prevSite.name}</span>
            </button>
            <span className="flex-shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--k-faint)' }}>
              {idx + 1}/{ordered.length}
            </span>
            <button
              onClick={() => onSelectSite(nextSite.id)}
              className="flex items-center justify-end gap-1 min-w-0 flex-1 rounded-full pl-3 pr-2 py-1.5"
              style={{ background: 'rgba(255,255,255,0.09)' }}
            >
              <span className="truncate text-[11.5px] text-white/85">{nextSite.name}</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: nextSite.alert.color }} />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4" style={{ paddingBottom: 100 }}>
        <SegmentedControl options={DETAIL_TABS} value={tab} onChange={setTab} size="sm" />

        {tab === 'now' && (
          <div className="pt-4">
            <div className="flex gap-2.5">
              <div className="flex-1 rounded-2xl border p-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                <div className="text-[11px]" style={{ color: 'var(--k-sub)' }}>Sea temp</div>
                <div className="serif text-[26px] mt-0.5" style={{ color: 'var(--k-ink)' }}>{site.sst_c != null ? `${site.sst_c.toFixed(1)}°` : '—'}</div>
                <Sparkline points={sstPoints} color="#0f766e" />
              </div>
              <div className="flex-1 rounded-2xl border p-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                <div className="text-[11px]" style={{ color: 'var(--k-sub)' }}>Heat stress</div>
                <div className="serif text-[26px] mt-0.5" style={{ color: site.alert.color }}>{site.dhw != null ? site.dhw.toFixed(1) : '—'}</div>
                <div className="text-[11px] mt-1.5" style={{ color: 'var(--k-sub)' }}>Degree heating weeks</div>
              </div>
            </div>

            <SectionDivider label="Conditions" />

            <div className="rounded-2xl border p-3.5 mb-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Waves</span>
                {waves && (
                  <span className="text-[12px] font-semibold rounded-full px-2.5 py-0.5" style={{ background: `${waves.conditions_color}22`, color: waves.conditions_color }}>
                    {waves.conditions_label}
                  </span>
                )}
              </div>
              {waves ? (
                <div className="flex gap-4 mt-3">
                  <div><div className="serif text-[19px]" style={{ color: 'var(--k-ink)' }}>{waves.wave_height_m.toFixed(1)} m</div><div className="text-[11px]" style={{ color: 'var(--k-sub)' }}>Height</div></div>
                  {waves.dominant_period_s != null && <div><div className="serif text-[19px]" style={{ color: 'var(--k-ink)' }}>{waves.dominant_period_s.toFixed(0)} s</div><div className="text-[11px]" style={{ color: 'var(--k-sub)' }}>Period</div></div>}
                  {waves.mean_direction_label && <div><div className="serif text-[19px]" style={{ color: 'var(--k-ink)' }}>{waves.mean_direction_label}</div><div className="text-[11px]" style={{ color: 'var(--k-sub)' }}>Swell</div></div>}
                </div>
              ) : (
                <div className="text-[12.5px] mt-2" style={{ color: 'var(--k-sub)' }}>
                  {conditions.loading ? 'Loading…' : 'No NOAA buoy close enough to this site to report waves.'}
                </div>
              )}
            </div>

            <div className="rounded-2xl border p-3.5 mb-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Tides · next 48h</div>
              {tides && tides.predictions.length > 0 ? (
                <TideMiniChart predictions={tides.predictions} />
              ) : (
                <div className="text-[12.5px] mt-2" style={{ color: 'var(--k-sub)' }}>
                  {conditions.loading ? 'Loading…' : 'No NOAA tide gauge assigned to this site.'}
                </div>
              )}
            </div>

            <WaterClarityCard turbidity={conditions.turbidity} loading={conditions.loading} />

            {recentHere.length > 0 && (
              <>
                <SectionDivider label="Recent here" />
                <div className="flex flex-col gap-2.5">
                  {recentHere.map(log => (
                    <div key={log.id} className="flex gap-3 items-start rounded-2xl border px-3.5 py-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#16A34A' }} />
                      <div className="flex-1">
                        <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>
                          {log.diver_name || 'Anonymous diver'} <span className="font-normal text-[12px]" style={{ color: 'var(--k-sub)' }}>· {new Date(log.submitted_at).toLocaleDateString()}</span>
                        </div>
                        {log.general_notes && <div className="serif text-[14px] mt-0.5" style={{ color: 'var(--k-ink2)' }}>&ldquo;{log.general_notes}&rdquo;</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'temperature' && (
          <div className="pt-4 flex flex-col gap-3">
            <ChartCard
              title="60-day SST history"
              subtitle="Daily sea surface temp vs bleaching thresholds · NOAA/JPL MUR"
            >
              <TempTrendChart siteId={site.id} mmm={site.mmm_c} height={200} />
            </ChartCard>

            <ChartCard
              title="Year over year"
              subtitle="This year vs last year, same 180-day window"
            >
              <SstYoYChart siteId={site.id} mmm={site.mmm_c} height={170} />
            </ChartCard>

            <ChartCard
              title="DHW forecast · 28 days"
              subtitle="Projected heat stress if the current SST trend holds"
            >
              <DhwForecastChart siteId={site.id} mmm={site.mmm_c} height={170} />
            </ChartCard>

            <p className="text-[11.5px] leading-[1.6] px-1" style={{ color: 'var(--k-sub)' }}>
              Bleaching risk builds when sea temp sits above this reef&apos;s warmest historical
              month ({site.mmm_c}°C) for weeks at a time — that accumulation is what degree
              heating weeks measure.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
      <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>{title}</div>
      <div className="text-[11px] mb-2" style={{ color: 'var(--k-sub)' }}>{subtitle}</div>
      {children}
    </div>
  )
}

/**
 * Water clarity comes from MODIS Kd490, which is optical — a cloud over the reef on the
 * satellite's overpass means that day simply has no value. Gaps are the norm, not a bug,
 * so the card says which days are missing and why rather than showing a bare dash.
 */
function WaterClarityCard({ turbidity, loading }: { turbidity: { latest: ClarityDay | null; history: ClarityDay[] } | null; loading: boolean }) {
  const [openDay, setOpenDay] = useState<ClarityDay | null>(null)
  const history = turbidity?.history ?? []
  const cloudyDays = history.filter(d => d.kd490 == null).length
  const latest = turbidity?.latest ?? null

  return (
    <div className="rounded-2xl border p-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
      <div className="flex justify-between items-baseline">
        <span className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Water clarity</span>
        <span className="serif text-[17px]" style={{ color: latest ? '#0f766e' : 'var(--k-faint)' }}>
          {latest?.estimated_visibility_m != null ? `${latest.estimated_visibility_m.toFixed(0)} m` : '—'}
        </span>
      </div>
      <div className="text-[11px] mb-2.5" style={{ color: 'var(--k-sub)' }}>
        Est. visibility · NASA MODIS satellite · last 14 days
      </div>

      {loading && <div className="text-[12.5px]" style={{ color: 'var(--k-sub)' }}>Loading…</div>}

      {!loading && history.length === 0 && (
        <div className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--k-sub)' }}>
          No clarity data for this reef. Visibility is derived from NASA MODIS satellite imagery,
          and the feed returned nothing for this location — remote sites outside the satellite&apos;s
          reef grid often have no coverage at all.
        </div>
      )}

      {!loading && history.length > 0 && (
        <>
          {/* Tapping a bar is the touch equivalent of the desktop hover tooltip. */}
          <div className="flex gap-[3px] items-end" style={{ height: 44 }}>
            {history.map(day => {
              const missing = day.kd490 == null
              const isOpen = openDay?.date === day.date
              return (
                <button
                  key={day.date}
                  onClick={() => setOpenDay(isOpen ? null : day)}
                  aria-label={`${day.date}: ${day.label}`}
                  className="flex-1 rounded-[3px]"
                  style={{
                    height: missing ? '18%' : `${Math.min(100, ((day.estimated_visibility_m ?? 0) / 25) * 100)}%`,
                    background: day.color,
                    // Faded + stubby is the "no satellite pass" state, so a cloudy day never
                    // reads as a genuinely murky one.
                    opacity: missing ? 0.35 : 1,
                    outline: isOpen ? '2px solid #0f766e' : undefined,
                    outlineOffset: 1,
                  }}
                />
              )
            })}
          </div>

          <div className="text-[11px] mt-2" style={{ color: 'var(--k-sub)' }}>
            {openDay ? (
              <>
                <span style={{ color: 'var(--k-ink2)', fontWeight: 600 }}>
                  {new Date(`${openDay.date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {' · '}
                {openDay.kd490 != null
                  ? `${openDay.label} · ~${openDay.estimated_visibility_m} m visibility`
                  : 'No satellite pass — cloud cover over the reef'}
              </>
            ) : (
              <>Oldest on the left · tap a bar for that day</>
            )}
          </div>

          {cloudyDays > 0 && (
            <div className="flex items-start gap-2 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--k-hair)' }}>
              <span className="w-3 h-3 rounded-[3px] flex-shrink-0 mt-0.5" style={{ background: '#d1d5db', opacity: 0.35 }} />
              <span className="text-[11px] leading-[1.55]" style={{ color: 'var(--k-sub)' }}>
                {cloudyDays === history.length ? (
                  <>Clouds covered this reef on all {history.length} days, so there&apos;s no visibility
                  estimate right now. MODIS reads clarity optically and can&apos;t see through cloud —
                  check back after a clear day.</>
                ) : (
                  <>{cloudyDays} of {history.length} days are blank because cloud cover blocked the
                  satellite&apos;s view — not because the water was murky.</>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TideMiniChart({ predictions }: { predictions: { time: string; height_m: number }[] }) {
  const heights = predictions.map(p => p.height_m)
  const min = Math.min(...heights)
  const max = Math.max(...heights)
  const range = max - min || 1
  const w = 300, h = 80
  const nowIdx = predictions.findIndex(p => new Date(p.time).getTime() > Date.now())
  const pts = predictions.map((p, i) => {
    const x = (i / (predictions.length - 1)) * w
    const y = h - 6 - ((p.height_m - min) / range) * (h - 20)
    return { x, y }
  })
  const line = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M0,${h} L` + pts.map(p => `${p.x},${p.y}`).join(' L') + ` L${w},${h} Z`
  const nowX = nowIdx >= 0 ? (nowIdx / (predictions.length - 1)) * w : w * 0.4

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }}>
      <path d={area} fill="rgba(15,118,110,0.12)" />
      <polyline points={line} fill="none" stroke="#0f766e" strokeWidth="2.2" />
      <line x1={nowX} y1={6} x2={nowX} y2={h} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
      <text x={nowX + 4} y={14} fontSize="9" fill="#94a3b8">now</text>
    </svg>
  )
}

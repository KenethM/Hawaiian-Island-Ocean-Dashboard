import { useEffect, useState } from 'react'
import { SectionDivider } from '../components/SectionDivider'
import { useOceanConditions } from '../../hooks/useOceanConditions'
import { useSstHistory } from '../../hooks/useSstHistory'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { ReefSite } from '../../types'
import type { DiverLogWithCoords } from '../../hooks/useDiverLogs'

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
  site, diverLogs, onBack, onSignInClick,
}: {
  site: ReefSite
  diverLogs: DiverLogWithCoords[]
  onBack: () => void
  onSignInClick: () => void
}) {
  const { user } = useAuth()
  const conditions = useOceanConditions(site.id)
  const { history } = useSstHistory(site.id, 10)
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)

  useEffect(() => {
    if (!user) { setSubscribed(false); return }
    api.getSubscriptions().then(subs => setSubscribed(subs.some(s => s.reef_site_id === site.id))).catch(() => {})
  }, [user, site.id])

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
  const clarity = conditions.turbidity

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-shrink-0 px-5 pb-5"
        style={{ background: 'var(--k-panel)', borderRadius: '0 0 22px 22px' }}
      >
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div>
              <div className="serif text-[22px] text-white">{site.name}</div>
              <div className="text-[12px]" style={{ color: 'var(--k-faint)' }}>{site.island} · reef site</div>
            </div>
          </div>
          <button
            onClick={toggleAlert}
            disabled={subLoading}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
            style={{ background: subscribed ? '#15803D' : 'rgba(255,255,255,0.12)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            {subscribed ? 'Following' : 'Alert me'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3.5">
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{ background: 'rgba(22,163,74,0.2)', color: '#86efac' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: site.alert.color }} />
            {site.alert.label}
          </span>
          <span className="text-[12px]" style={{ color: 'var(--k-faint)' }}>Bleaching alert: {site.alert.label.toLowerCase()}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4" style={{ paddingBottom: 100 }}>
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
            <div className="text-[12.5px] mt-2" style={{ color: 'var(--k-sub)' }}>{conditions.loading ? 'Loading…' : 'No buoy data nearby.'}</div>
          )}
        </div>

        <div className="rounded-2xl border p-3.5 mb-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Tides · next 48h</div>
          {tides && tides.predictions.length > 0 ? (
            <TideMiniChart predictions={tides.predictions} />
          ) : (
            <div className="text-[12.5px] mt-2" style={{ color: 'var(--k-sub)' }}>{conditions.loading ? 'Loading…' : 'No tide station nearby.'}</div>
          )}
        </div>

        <div className="rounded-2xl border p-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Water clarity</span>
            <span className="serif text-[17px]" style={{ color: '#0f766e' }}>{clarity?.latest?.estimated_visibility_m != null ? `${clarity.latest.estimated_visibility_m.toFixed(0)} m` : '—'}</span>
          </div>
          <div className="text-[11px] mb-2.5" style={{ color: 'var(--k-sub)' }}>Est. visibility · last 14 days</div>
          {clarity && clarity.history.length > 0 ? (
            <div className="flex gap-[3px] items-end" style={{ height: 44 }}>
              {clarity.history.map(day => (
                <div
                  key={day.date}
                  className="flex-1 rounded-[3px]"
                  style={{ height: `${day.estimated_visibility_m != null ? Math.min(100, (day.estimated_visibility_m / 25) * 100) : 20}%`, background: day.color || '#cbd5d3' }}
                  title={`${day.date}: ${day.label}`}
                />
              ))}
            </div>
          ) : (
            <div className="text-[12.5px]" style={{ color: 'var(--k-sub)' }}>{conditions.loading ? 'Loading…' : 'No clarity data.'}</div>
          )}
        </div>

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

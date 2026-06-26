import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { ReefSite, SstHistory, WaveData, TideData, TurbidityData } from '../types'

interface Props {
  sites: ReefSite[]
  onClose: () => void
}

interface SiteSnapshot {
  sst: SstHistory | null
  waves: WaveData | null
  tides: TideData | null
  turbidity: TurbidityData | null
  loading: boolean
}

function useSiteSnapshot(siteId: string | null): SiteSnapshot {
  const [snap, setSnap] = useState<SiteSnapshot>({ sst: null, waves: null, tides: null, turbidity: null, loading: false })

  useEffect(() => {
    if (!siteId) { setSnap({ sst: null, waves: null, tides: null, turbidity: null, loading: false }); return }
    setSnap(prev => ({ ...prev, loading: true }))
    Promise.all([
      api.getSstHistory(siteId, 30).catch(() => null),
      api.getWaves(siteId).catch(() => null),
      api.getTides(siteId).catch(() => null),
      api.getTurbidity(siteId).catch(() => null),
    ]).then(([sst, waves, tides, turbidity]) => {
      setSnap({ sst, waves, tides, turbidity, loading: false })
    })
  }, [siteId])

  return snap
}

function SiteColumn({ site, snap }: { site: ReefSite; snap: SiteSnapshot }) {
  const minSst = snap.sst ? Math.min(...snap.sst.readings.map(r => r.sst_c)) : null
  const maxSst = snap.sst ? Math.max(...snap.sst.readings.map(r => r.sst_c)) : null

  const cardCls = 'bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3'
  const subLabel = 'text-xs text-gray-500 dark:text-slate-400'
  const value = 'font-semibold text-gray-800 dark:text-slate-100'
  const sectionTitle = 'text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2'
  const noData = 'text-xs text-gray-400 dark:text-slate-500'

  return (
    <div className="flex-1 min-w-0">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-bold text-gray-900 dark:text-white">{site.name}</h3>
        <p className={`text-xs ${subLabel}`}>{site.island} · {site.depth_m}m depth</p>
        <span
          className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ background: site.alert.color }}
        >
          {site.alert.label}
        </span>
      </div>
      {snap.loading ? (
        <div className="p-4 space-y-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-100 dark:bg-slate-700 rounded" />
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-3 text-sm">
          <div className={cardCls}>
            <p className={sectionTitle}>Temperature</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className={subLabel}>Current SST</span>
                <span className={value}>{site.sst_c != null ? `${site.sst_c.toFixed(1)}°C` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className={subLabel}>30-day min/max</span>
                <span className={value}>{minSst != null && maxSst != null ? `${minSst.toFixed(1)}–${maxSst.toFixed(1)}°C` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className={subLabel}>MMM</span>
                <span className={value}>{site.mmm_c}°C</span>
              </div>
              <div className="flex justify-between">
                <span className={subLabel}>DHW</span>
                <span className={`font-semibold ${(site.dhw ?? 0) >= 4 ? 'text-orange-500' : 'text-gray-800 dark:text-slate-100'}`}>
                  {site.dhw != null ? `${site.dhw.toFixed(1)} °C-wks` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <p className={sectionTitle}>Waves</p>
            {snap.waves?.data ? (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className={subLabel}>Height</span>
                  <span className={value}>{snap.waves.data.wave_height_m.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className={subLabel}>Conditions</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: snap.waves.data.conditions_color }}>
                    {snap.waves.data.conditions_label}
                  </span>
                </div>
                {snap.waves.data.dominant_period_s && (
                  <div className="flex justify-between">
                    <span className={subLabel}>Period</span>
                    <span className={value}>{snap.waves.data.dominant_period_s}s</span>
                  </div>
                )}
              </div>
            ) : <p className={noData}>No buoy data</p>}
          </div>

          <div className={cardCls}>
            <p className={sectionTitle}>Water Clarity</p>
            {snap.turbidity?.latest ? (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className={subLabel}>Visibility</span>
                  <span className={value}>~{snap.turbidity.latest.estimated_visibility_m} m</span>
                </div>
                <div className="flex justify-between">
                  <span className={subLabel}>Clarity</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: snap.turbidity.latest.color }}>
                    {snap.turbidity.latest.label}
                  </span>
                </div>
              </div>
            ) : <p className={noData}>No satellite data</p>}
          </div>

          <div className={cardCls}>
            <p className={sectionTitle}>Tides</p>
            {snap.tides?.current ? (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className={subLabel}>Current</span>
                  <span className={value}>{snap.tides.current.height_m.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className={subLabel}>State</span>
                  <span className={`${value} capitalize`}>{snap.tides.tide_state ?? '—'}</span>
                </div>
              </div>
            ) : <p className={noData}>No tide data</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function SiteComparison({ sites, onClose }: Props) {
  const [siteAId, setSiteAId] = useState<string>(sites[0]?.id ?? '')
  const [siteBId, setSiteBId] = useState<string>(sites[1]?.id ?? '')

  const siteA = sites.find(s => s.id === siteAId) ?? null
  const siteB = sites.find(s => s.id === siteBId) ?? null
  const snapA = useSiteSnapshot(siteAId || null)
  const snapB = useSiteSnapshot(siteBId || null)

  const selectCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Site Comparison</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-2xl leading-none">×</button>
        </div>

        {/* Site selectors */}
        <div className="flex gap-4 px-5 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Site A</label>
            <select value={siteAId} onChange={e => setSiteAId(e.target.value)} className={selectCls}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Site B</label>
            <select value={siteBId} onChange={e => setSiteBId(e.target.value)} className={selectCls}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Comparison columns */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex divide-x divide-gray-200 dark:divide-slate-700">
            {siteA && <SiteColumn site={siteA} snap={snapA} />}
            {siteB && <SiteColumn site={siteB} snap={snapB} />}
          </div>
        </div>
      </div>
    </div>
  )
}

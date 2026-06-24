import { useState, useEffect } from 'react'
import type { ReefSite } from '../types'
import { TempTrendChart } from './Charts/TempTrendChart'
import { TideChart } from './Charts/TideChart'
import { DhwForecastChart } from './Charts/DhwForecastChart'
import { SstYoYChart } from './Charts/SstYoYChart'
import { DiverLogForm } from './DiverLog/DiverLogForm'
import { DiverLogList } from './DiverLog/DiverLogList'
import { useAuth } from '../context/AuthContext'
import { useOceanConditions } from '../hooks/useOceanConditions'
import { api } from '../services/api'

interface Props {
  site: ReefSite
  allSites: ReefSite[]
  onClose: () => void
  onSignInClick?: () => void
}

type Tab = 'overview' | 'temperature' | 'log' | 'reports'

function FreshnessTag({ fetchedAt }: { fetchedAt: Date | null }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!fetchedAt) return
    const update = () => {
      const mins = Math.floor((Date.now() - fetchedAt.getTime()) / 60_000)
      setLabel(mins < 1 ? 'just now' : `${mins}m ago`)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [fetchedAt])
  if (!fetchedAt) return null
  return <span className="text-[10px] text-gray-400">· updated {label}</span>
}

export function SitePanel({ site, allSites, onClose, onSignInClick }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [logRefresh, setLogRefresh] = useState(0)
  const { user } = useAuth()
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const conditions = useOceanConditions(site.id)

  useEffect(() => {
    if (!user) { setSubscribed(false); return }
    api.getSubscriptions()
      .then(subs => setSubscribed(subs.some(s => s.reef_site_id === site.id)))
      .catch(() => {})
  }, [user, site.id])

  async function toggleSubscription() {
    if (!user) { onSignInClick?.(); return }
    setSubLoading(true)
    try {
      if (subscribed) {
        await api.unsubscribe(site.id)
        setSubscribed(false)
      } else {
        await api.subscribe(site.id)
        setSubscribed(true)
      }
    } catch {
      // 409 on double-subscribe is safe to ignore
    } finally {
      setSubLoading(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'temperature', label: 'Temperature' },
    { id: 'log', label: 'Log Dive' },
    { id: 'reports', label: 'Reports' },
  ]

  return (
    <div className="h-full flex flex-col bg-white shadow-xl border-l border-gray-200">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{site.name}</h2>
            <p className="text-sm text-gray-500">{site.island} · {site.depth_m}m depth</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: site.alert.color }}
          >
            <span className="w-2 h-2 rounded-full bg-white/50 inline-block" />
            {site.alert.label}
          </span>
          {site.sst_c !== null && (
            <span className="text-sm text-gray-600">SST: <strong>{site.sst_c.toFixed(1)}°C</strong> · MMM: {site.mmm_c}°C</span>
          )}
          <button
            onClick={toggleSubscription}
            disabled={subLoading}
            title={subscribed ? 'Unsubscribe from bleaching alerts' : 'Get email alerts when bleaching is detected'}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
              subscribed
                ? 'bg-ocean-700 border-ocean-700 text-white hover:bg-ocean-800'
                : 'bg-white border-gray-300 text-gray-600 hover:border-ocean-500 hover:text-ocean-700'
            }`}
          >
            <span>{subscribed ? '🔔' : '🔕'}</span>
            {subscribed ? 'Alerts on' : 'Alert me'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-b-2 border-ocean-700 text-ocean-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{site.description}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Island', site.island],
                ['Max Depth', `${site.depth_m} m`],
                ['MMM Temp', `${site.mmm_c}°C`],
                ['Current SST', site.sst_c !== null ? `${site.sst_c.toFixed(1)}°C` : 'No data'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            {/* CRW thermal stress */}
            {(site.dhw !== null || site.hotspot !== null) && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Thermal Stress (NOAA CRW)</p>
                <div className="grid grid-cols-2 gap-3">
                  {site.dhw !== null && (
                    <div>
                      <p className="text-xs text-gray-400">Degree Heating Weeks</p>
                      <p className={`font-bold text-lg ${site.dhw >= 8 ? 'text-red-600' : site.dhw >= 4 ? 'text-orange-500' : 'text-gray-800'}`}>
                        {site.dhw.toFixed(1)} <span className="text-xs font-normal text-gray-500">°C-weeks</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {site.dhw >= 8 ? 'Significant bleaching likely' : site.dhw >= 4 ? 'Bleaching likely' : site.dhw >= 1 ? 'Watch threshold' : 'No accumulated stress'}
                      </p>
                    </div>
                  )}
                  {site.hotspot !== null && (
                    <div>
                      <p className="text-xs text-gray-400">Hotspot</p>
                      <p className="font-bold text-lg text-gray-800">
                        +{site.hotspot.toFixed(2)} <span className="text-xs font-normal text-gray-500">°C</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Above bleaching threshold</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Live Conditions */}
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Conditions</p>
              <FreshnessTag fetchedAt={conditions.fetchedAt} />
            </div>

            {conditions.loading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-16 bg-gray-100 rounded-lg" />
                <div className="h-24 bg-gray-100 rounded-lg" />
                <div className="h-14 bg-gray-100 rounded-lg" />
              </div>
            )}

            {!conditions.loading && (
              <div className="space-y-3">
                {/* Waves */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Wave Conditions
                    {conditions.waves?.buoy_name && (
                      <span className="normal-case font-normal ml-1">· {conditions.waves.buoy_name} buoy</span>
                    )}
                  </p>
                  {conditions.waves?.data ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {conditions.waves.data.wave_height_m.toFixed(1)} m
                        </span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: conditions.waves.data.conditions_color }}
                        >
                          {conditions.waves.data.conditions_label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {conditions.waves.data.dominant_period_s != null && (
                          <span>Period: {conditions.waves.data.dominant_period_s}s</span>
                        )}
                        {conditions.waves.data.mean_direction_label && (
                          <span>Swell from {conditions.waves.data.mean_direction_label}</span>
                        )}
                        {conditions.waves.data.water_temp_c != null && (
                          <span>Water: {conditions.waves.data.water_temp_c.toFixed(1)}°C</span>
                        )}
                        {conditions.waves.data.wind_speed_ms != null && (
                          <span>Wind: {conditions.waves.data.wind_speed_ms.toFixed(1)} m/s</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">No buoy data available</p>
                  )}
                </div>

                {/* Salinity */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Salinity</p>
                  {conditions.salinity?.salinity_psu != null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">{conditions.salinity.salinity_psu} PSU</span>
                      <span className="text-xs text-gray-400">
                        · station {conditions.salinity.station_id}
                        {conditions.salinity.observed_at && ` · ${conditions.salinity.observed_at.slice(0, 16)}`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">{conditions.salinity?.note ?? 'No salinity data available'}</p>
                  )}
                </div>

                {/* Tides */}
                {conditions.tides?.station_id && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Tides
                      {conditions.tides.station_name && (
                        <span className="normal-case font-normal ml-1">· {conditions.tides.station_name}</span>
                      )}
                    </p>
                    {conditions.tides.current && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-bold text-gray-900">
                          {conditions.tides.current.height_m.toFixed(2)} m
                        </span>
                        {conditions.tides.tide_state && (
                          <span className="text-xs text-gray-500">
                            {conditions.tides.tide_state === 'rising' ? '↑ Rising' : '↓ Falling'}
                          </span>
                        )}
                      </div>
                    )}
                    {conditions.tides.predictions.length > 0 && (
                      <TideChart
                        predictions={conditions.tides.predictions.slice(0, 48)}
                        highLows={conditions.tides.high_lows}
                        currentTime={conditions.tides.current?.time ?? ''}
                      />
                    )}
                    {conditions.tides.high_lows.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {conditions.tides.high_lows.slice(0, 4).map((hl, i) => (
                          <span key={i}>
                            <span className={hl.type === 'H' ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                              {hl.type === 'H' ? 'High' : 'Low'}
                            </span>{' '}
                            {hl.time.slice(11, 16)} · {hl.height_m.toFixed(2)} m
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Water Clarity */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Water Clarity
                    <span className="normal-case font-normal ml-1">· MODIS satellite · past 14 days</span>
                  </p>
                  {conditions.turbidity?.history.length ? (
                    <>
                      {conditions.turbidity.latest ? (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg font-bold text-gray-900">
                            ~{conditions.turbidity.latest.estimated_visibility_m} m visibility
                          </span>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: conditions.turbidity.latest.color }}
                          >
                            {conditions.turbidity.latest.label}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mb-3">No clear-sky reading this week</p>
                      )}
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {conditions.turbidity.history.map((day, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 w-8 flex flex-col items-center gap-0.5"
                            title={day.kd490 != null
                              ? `${day.date}\n${day.label}\nKd490: ${day.kd490} m⁻¹\nEst. visibility: ~${day.estimated_visibility_m} m`
                              : `${day.date}\nNo satellite data`}
                          >
                            <div
                              className="w-full rounded"
                              style={{ height: '20px', background: day.color, opacity: day.kd490 != null ? 1 : 0.35 }}
                            />
                            <span className="text-[9px] text-gray-400 leading-none">
                              {day.date.slice(5).replace('-', '/')}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
                        <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ background: '#22c55e' }} />Very Clear</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ background: '#84cc16' }} />Clear</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ background: '#eab308' }} />Moderate</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ background: '#f97316' }} />Slightly Turbid</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ background: '#ef4444' }} />Turbid</span>
                        <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5 opacity-35" style={{ background: '#d1d5db' }} />No data</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">No satellite data available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'temperature' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">60-Day SST History</p>
              <p className="text-xs text-gray-500 mb-3">Daily SST vs bleaching thresholds · NOAA/JPL MUR SST</p>
              <TempTrendChart siteId={site.id} mmm={site.mmm_c} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Year-over-Year Comparison</p>
              <p className="text-xs text-gray-500 mb-3">This year vs last year, same 180-day window</p>
              <SstYoYChart siteId={site.id} mmm={site.mmm_c} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">DHW Forecast (28 days)</p>
              <p className="text-xs text-gray-500 mb-3">Projected heat stress if current SST trend continues</p>
              <DhwForecastChart siteId={site.id} mmm={site.mmm_c} />
            </div>
          </div>
        )}

        {tab === 'log' && (
          <DiverLogForm
            sites={allSites}
            defaultSiteId={site.id}
            onSubmitted={() => setLogRefresh(n => n + 1)}
            onSignInClick={onSignInClick}
          />
        )}

        {tab === 'reports' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">Community diver observations for this site.</p>
            <DiverLogList siteId={site.id} sites={allSites} refresh={logRefresh} />
          </div>
        )}
      </div>
    </div>
  )
}

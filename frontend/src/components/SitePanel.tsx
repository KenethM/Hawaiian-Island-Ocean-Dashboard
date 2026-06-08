import { useState } from 'react'
import type { ReefSite } from '../types'
import { TempTrendChart } from './Charts/TempTrendChart'
import { DiverLogForm } from './DiverLog/DiverLogForm'
import { DiverLogList } from './DiverLog/DiverLogList'

interface Props {
  site: ReefSite
  allSites: ReefSite[]
  onClose: () => void
  onSignInClick?: () => void
}

type Tab = 'overview' | 'temperature' | 'log' | 'reports'

export function SitePanel({ site, allSites, onClose, onSignInClick }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [logRefresh, setLogRefresh] = useState(0)

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

        {/* Alert badge */}
        <div className="mt-2 flex items-center gap-3">
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
          </div>
        )}

        {tab === 'temperature' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Daily SST (last 60 days) vs bleaching thresholds from NOAA/JPL MUR SST.
            </p>
            <TempTrendChart siteId={site.id} mmm={site.mmm_c} />
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

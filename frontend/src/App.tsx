import { useState, useEffect } from 'react'
import { ReefMap } from './components/Map/ReefMap'
import { SitePanel } from './components/SitePanel'
import { AlertBanner } from './components/AlertBanner'
import { RecentSightingsFeed } from './components/Map/RecentSightingsFeed'
import { CommunityChart } from './components/Charts/CommunityChart'
import { BleachingHistoryChart } from './components/Charts/BleachingHistoryChart'
import { ReportsOverTimeChart } from './components/Charts/ReportsOverTimeChart'
import { DiverLogForm } from './components/DiverLog/DiverLogForm'
import { DiverLogList } from './components/DiverLog/DiverLogList'
import { AuthModal } from './components/Auth/AuthModal'
import { PhDashboard } from './components/PhDashboard'
import { useCurrentConditions } from './hooks/useCurrentConditions'
import { useDiverLogs } from './hooks/useDiverLogs'
import { useAuth } from './context/AuthContext'
import { api } from './services/api'
import type { SiteStat, DiverStatOverTime } from './types'

type View = 'dashboard' | 'community' | 'log-dive' | 'ph'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [showAuth, setShowAuth] = useState(false)
  const { user, logout } = useAuth()
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [logRefresh, setLogRefresh] = useState(0)
  const [stats, setStats] = useState<SiteStat[]>([])
  const [statsOverTime, setStatsOverTime] = useState<DiverStatOverTime[]>([])

  const { sites, loading, error } = useCurrentConditions()
  const { logs: diverLogs, loading: diverLogsLoading } = useDiverLogs(sites)
  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null

  const siteNames = Object.fromEntries(sites.map(s => [s.id, s.name]))

  useEffect(() => {
    api.getDiverStatsBySite().then(setStats).catch(() => {})
    api.getDiverStatsOverTime().then(setStatsOverTime).catch(() => {})
  }, [logRefresh])

  const navItem = (v: View, label: string) => (
    <button
      onClick={() => setView(v)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        view === v ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Nav */}
      <header className="bg-ocean-900 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="mr-4">
          <h1 className="text-white font-bold text-base leading-tight">Hawaii Coral Reef</h1>
          <p className="text-ocean-100 text-xs">Health Dashboard</p>
        </div>
        <nav className="flex gap-1">
          {navItem('dashboard', 'Dashboard')}
          {navItem('community', 'Community Data')}
          {navItem('log-dive', 'Log a Dive')}
          {navItem('ph', 'Ocean pH')}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-white/50 hidden sm:block">Data: NOAA/JPL MUR SST · NOAA CRW · HOT · CMEMS</span>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">{user.full_name ?? user.email}</span>
              <button
                onClick={logout}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* Alert banner */}
      <AlertBanner />

      {/* Main content */}
      {view === 'dashboard' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Map */}
          <div className="flex-1 relative">
            {loading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-50">
                <span className="text-gray-500 text-sm">Loading reef data from NOAA…</span>
              </div>
            )}
            {error && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-300 text-red-700 rounded-md px-4 py-2 text-sm">
                {error}
              </div>
            )}
            <ReefMap
              sites={sites}
              selectedSiteId={selectedSiteId}
              onSelectSite={id => setSelectedSiteId(id === selectedSiteId ? null : id)}
              diverLogs={diverLogs}
            />
          </div>

          {/* Side panel — site detail or recent sightings feed */}
          {selectedSite ? (
            <div className="w-80 xl:w-96 flex-shrink-0 overflow-hidden">
              <SitePanel
                site={selectedSite}
                allSites={sites}
                onClose={() => setSelectedSiteId(null)}
                onSignInClick={() => setShowAuth(true)}
              />
            </div>
          ) : (
            <RecentSightingsFeed
              logs={diverLogs}
              loading={diverLogsLoading}
              onSelectSite={id => setSelectedSiteId(id)}
            />
          )}
        </div>
      )}

      {view === 'community' && (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Community Reports</h2>
          <p className="text-sm text-gray-500 mb-6">
            Diver observations across all Hawaiian reef sites. Bar colors reflect avg bleaching severity.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 text-sm mb-0.5">Bleaching & Coral Cover Over Time</h3>
              <p className="text-xs text-gray-400 mb-3">Avg % from diver reports · last 6 months</p>
              <BleachingHistoryChart data={statsOverTime} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 text-sm mb-0.5">Dive Reports Over Time</h3>
              <p className="text-xs text-gray-400 mb-3">Reports per day · color = avg bleaching severity</p>
              <ReportsOverTimeChart data={statsOverTime} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Reports by Site</h3>
            <CommunityChart stats={stats} siteNames={siteNames} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Recent Observations (All Sites)</h3>
            <DiverLogList sites={sites} refresh={logRefresh} />
          </div>
        </div>
      )}

      {view === 'ph' && (
        <PhDashboard onSignInClick={() => setShowAuth(true)} />
      )}

      {view === 'log-dive' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Log a Dive Observation</h2>
            <p className="text-sm text-gray-500 mb-6">
              Help track coral health across Hawaii. Your data is shared with the community.
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <DiverLogForm
                sites={sites}
                onSubmitted={() => { setLogRefresh(n => n + 1); setView('community') }}
                onSignInClick={() => setShowAuth(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

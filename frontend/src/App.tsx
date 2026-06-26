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
import { SiteComparison } from './components/SiteComparison'
import { AdminPanel } from './components/AdminPanel'
import { HelpModal } from './components/HelpModal'
import { useCurrentConditions } from './hooks/useCurrentConditions'
import { useDiverLogs } from './hooks/useDiverLogs'
import { useAuth } from './context/AuthContext'
import { useTheme } from './context/ThemeContext'
import { api } from './services/api'
import type { SiteStat, DiverStatOverTime } from './types'

type View = 'dashboard' | 'community' | 'log-dive' | 'ph' | 'admin'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [showAuth, setShowAuth] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [logRefresh, setLogRefresh] = useState(0)
  const [stats, setStats] = useState<SiteStat[]>([])
  const [statsOverTime, setStatsOverTime] = useState<DiverStatOverTime[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const { sites, loading, error, fetchedAt } = useCurrentConditions()
  const { logs: diverLogs, loading: diverLogsLoading } = useDiverLogs(sites)
  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null

  const siteNames = Object.fromEntries(sites.map(s => [s.id, s.name]))

  useEffect(() => {
    api.getDiverStatsBySite().then(setStats).catch(() => {})
    api.getDiverStatsOverTime().then(setStatsOverTime).catch(() => {})
  }, [logRefresh])

  const [freshnessLabel, setFreshnessLabel] = useState('')
  useEffect(() => {
    if (!fetchedAt) return
    const update = () => {
      const mins = Math.floor((Date.now() - fetchedAt.getTime()) / 60_000)
      setFreshnessLabel(mins < 1 ? 'Updated just now' : `Updated ${mins}m ago`)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [fetchedAt])

  const navItems: { id: View; label: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'community', label: 'Community Data' },
    { id: 'log-dive', label: 'Log a Dive' },
    { id: 'ph', label: 'Ocean pH' },
    { id: 'admin', label: 'Admin', adminOnly: true },
  ]

  const visibleNavItems = navItems.filter(n => !n.adminOnly || user?.is_admin)

  const navButton = (v: View, label: string, mobile = false) => (
    <button
      key={v}
      onClick={() => { setView(v); setMobileNavOpen(false) }}
      className={`${mobile ? 'w-full text-left px-4 py-3' : 'px-3 py-2'} text-sm font-medium rounded-md transition-colors ${
        view === v ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-900 font-sans">
      {/* Nav */}
      <header className="bg-ocean-900 px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <div className="mr-2 flex-shrink-0">
          <h1 className="text-white font-bold text-sm sm:text-base leading-tight">Hawaii Coral Reef</h1>
          <p className="text-ocean-100 text-xs">Health Dashboard</p>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1">
          {visibleNavItems.map(n => navButton(n.id, n.label))}
        </nav>

        {/* Compare button */}
        {sites.length >= 2 && (
          <button
            onClick={() => setShowComparison(true)}
            className="hidden md:flex items-center gap-1 text-xs text-white/60 hover:text-white px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
            title="Compare two reef sites side by side"
          >
            ⇄ Compare
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {fetchedAt && (
            <span className="text-[10px] text-white/40 hidden lg:block mr-1">{freshnessLabel}</span>
          )}
          <span className="text-xs text-white/50 hidden xl:block mr-1">NOAA/JPL · CRW · HOT · CMEMS</span>

          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center w-6 h-6 rounded-full border border-white/30 text-white/70 hover:text-white hover:border-white/60 hover:bg-white/10 transition-colors text-xs font-bold"
            title="Guide & cheat sheet"
          >
            ?
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="text-white/70 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors text-base leading-none"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '☽'}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80 hidden sm:block">{user.full_name ?? user.email}</span>
              {user.is_admin && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">admin</span>}
              <button onClick={logout} className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors">
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(o => !o)}
            className="md:hidden text-white/70 hover:text-white p-1"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileNavOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="md:hidden bg-ocean-800 py-2 flex-shrink-0">
          {visibleNavItems.map(n => navButton(n.id, n.label, true))}
          {sites.length >= 2 && (
            <button
              onClick={() => { setShowComparison(true); setMobileNavOpen(false) }}
              className="w-full text-left px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10"
            >
              ⇄ Compare Sites
            </button>
          )}
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showComparison && sites.length >= 2 && (
        <SiteComparison sites={sites} onClose={() => setShowComparison(false)} />
      )}

      {/* Alert banner */}
      <AlertBanner />

      {/* Main content */}
      {view === 'dashboard' && (
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          {/* Map — isolate keeps map z-indexes from bleeding above the header */}
          <div className="flex-1 relative isolate min-h-[50vh] md:min-h-0">
            {loading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-50">
                <span className="text-gray-500 dark:text-slate-400 text-sm">Loading reef data from NOAA…</span>
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

          {/* Sidebar toggle strip — desktop only, sits between map and sidebar as a flex sibling so it never overlaps Leaflet layers */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="hidden md:flex flex-col items-center justify-center w-4 flex-shrink-0 bg-gray-50 dark:bg-slate-700 border-x border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d={sidebarOpen ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
          </button>

          {/* Side panel */}
          {sidebarOpen && (
            selectedSite ? (
              <div className="w-full md:w-80 xl:w-96 flex-shrink-0 overflow-hidden border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700">
                <SitePanel
                  key={selectedSite.id}
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
            )
          )}
        </div>
      )}

      {view === 'community' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Community Reports</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Diver observations across all Hawaiian reef sites. Bar colors reflect avg bleaching severity.
              </p>
            </div>
            <a
              href={api.exportDiverLogsCsv()}
              download
              className="flex-shrink-0 flex items-center gap-1.5 text-xs bg-ocean-700 text-white px-3 py-2 rounded-md font-medium hover:bg-ocean-900 transition-colors"
            >
              ↓ Export CSV
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold text-gray-700 dark:text-slate-200 text-sm mb-0.5">Bleaching & Coral Cover Over Time</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Avg % from diver reports · last 6 months</p>
              <BleachingHistoryChart data={statsOverTime} />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold text-gray-700 dark:text-slate-200 text-sm mb-0.5">Dive Reports Over Time</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Reports per day · color = avg bleaching severity</p>
              <ReportsOverTimeChart data={statsOverTime} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-slate-200 mb-3 text-sm">Reports by Site</h3>
            <CommunityChart stats={stats} siteNames={siteNames} />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4">
            <h3 className="font-semibold text-gray-700 dark:text-slate-200 mb-3 text-sm">Recent Observations (All Sites)</h3>
            <DiverLogList sites={sites} refresh={logRefresh} />
          </div>
        </div>
      )}

      {view === 'ph' && (
        <PhDashboard onSignInClick={() => setShowAuth(true)} />
      )}

      {view === 'log-dive' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Log a Dive Observation</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              Help track coral health across Hawaii. Your data is shared with the community.
            </p>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5">
              <DiverLogForm
                sites={sites}
                onSubmitted={() => { setLogRefresh(n => n + 1); setView('community') }}
                onSignInClick={() => setShowAuth(true)}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && user?.is_admin && (
        <div className="flex-1 overflow-y-auto">
          <AdminPanel />
        </div>
      )}
    </div>
  )
}

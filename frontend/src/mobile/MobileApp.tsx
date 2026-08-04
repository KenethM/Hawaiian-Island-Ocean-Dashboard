import { useState } from 'react'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { ReefDetailScreen } from './screens/ReefDetailScreen'
import { CommunityScreen } from './screens/CommunityScreen'
import { LogDiveScreen } from './screens/LogDiveScreen'
import { OceanPhScreen } from './screens/OceanPhScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { AlertsScreen } from './screens/AlertsScreen'
import { AdminScreen } from './screens/AdminScreen'
import type { MobileTab, MoreScreen } from './types'
import { useCurrentConditions } from '../hooks/useCurrentConditions'
import { useDiverLogs } from '../hooks/useDiverLogs'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { AuthModal } from '../components/Auth/AuthModal'

export function MobileApp() {
  const [tab, setTab] = useState<MobileTab>('reef')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [moreScreen, setMoreScreen] = useState<MoreScreen>('profile')
  const [showAuth, setShowAuth] = useState(false)
  const [logRefresh, setLogRefresh] = useState(0)
  const { theme } = useTheme()
  const { user } = useAuth()
  const dark = theme === 'dark'

  const { sites } = useCurrentConditions()
  const { logs: diverLogs } = useDiverLogs(sites, 90, logRefresh)
  const selectedSite = sites.find(s => s.id === selectedSiteId) ?? null

  function changeTab(next: MobileTab) {
    if (next !== 'reef') setSelectedSiteId(null)
    if (next === 'more') setMoreScreen('profile')
    setTab(next)
  }

  const showFloatingTabBar = tab === 'reef' && !selectedSite

  return (
    <div className="kilo fixed inset-0 overflow-hidden" style={{ color: 'var(--k-ink)' }}>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <div className="absolute inset-0">
        {tab === 'reef' && !selectedSite && (
          <HomeScreen sites={sites} dark={dark} onOpenSite={setSelectedSiteId} />
        )}
        {tab === 'reef' && selectedSite && (
          <ReefDetailScreen
            site={selectedSite}
            sites={sites}
            diverLogs={diverLogs}
            onBack={() => setSelectedSiteId(null)}
            onSelectSite={setSelectedSiteId}
            onSignInClick={() => setShowAuth(true)}
          />
        )}

        {tab === 'community' && <CommunityScreen sites={sites} diverLogs={diverLogs} refreshKey={logRefresh} />}

        {tab === 'log' && (
          <LogDiveScreen
            sites={sites}
            onSubmitted={() => { setLogRefresh(n => n + 1); setTab('community') }}
            onSignInClick={() => setShowAuth(true)}
          />
        )}

        {tab === 'ph' && <OceanPhScreen />}

        {tab === 'more' && moreScreen === 'profile' && (
          <ProfileScreen
            diverLogs={diverLogs}
            onSignInClick={() => setShowAuth(true)}
            onNavigate={setMoreScreen}
            isAdmin={!!user?.is_admin}
          />
        )}
        {tab === 'more' && moreScreen === 'alerts' && (
          <AlertsScreen sites={sites} onBack={() => setMoreScreen('profile')} />
        )}
        {tab === 'more' && moreScreen === 'admin' && (
          <AdminScreen onBack={() => setMoreScreen('profile')} />
        )}
      </div>

      <div className="absolute left-0 right-0 bottom-0 z-40">
        <TabBar active={tab} onChange={changeTab} floating={showFloatingTabBar} />
      </div>
    </div>
  )
}

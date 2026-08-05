import { useMemo, useState, type ReactNode } from 'react'
import { Toggle } from '../components/Toggle'
import { SectionDivider } from '../components/SectionDivider'
import { ShareQrModal } from '../components/ShareQrModal'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import type { DiverLogWithCoords } from '../../hooks/useDiverLogs'
import type { MoreScreen } from '../types'

export function ProfileScreen({
  diverLogs, onSignInClick, onNavigate, isAdmin,
}: {
  diverLogs: DiverLogWithCoords[]
  onSignInClick: () => void
  onNavigate: (screen: MoreScreen) => void
  isAdmin: boolean
}) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [showQr, setShowQr] = useState(false)

  const myLogs = useMemo(
    () => (user?.full_name ? diverLogs.filter(l => l.diver_name === user.full_name) : []),
    [diverLogs, user]
  )
  const sitesVisited = new Set(myLogs.map(l => l.reef_site_id)).size

  const initials = user ? (user.full_name ?? user.email).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : ''

  return (
    <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
      {user ? (
        <>
          <div className="flex items-center gap-4 mb-1.5">
            <div className="w-[66px] h-[66px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#D1E7D5' }}>
              <span className="serif text-[26px]" style={{ color: '#15803D' }}>{initials}</span>
            </div>
            <div>
              <div className="serif text-[22px]" style={{ color: 'var(--k-ink)' }}>{user.full_name ?? 'Diver'}</div>
              <div className="text-[13px]" style={{ color: 'var(--k-sub)' }}>{user.email}</div>
            </div>
          </div>

          <div className="flex gap-2 mt-3.5">
            {user.cert_level && user.cert_level !== 'none' && (
              <span className="rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize" style={{ background: '#e6f5ec', color: '#15803D' }}>
                {user.cert_level.replace('_', ' ')}
              </span>
            )}
            {user.affiliation && (
              <span className="rounded-full px-3 py-1.5 text-[12px] capitalize" style={{ background: 'var(--k-card)', border: '1px solid var(--k-border)', color: 'var(--k-sub)' }}>
                {user.affiliation}
              </span>
            )}
            {user.is_admin && (
              <span className="rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: '#fef3c7', color: '#b45309' }}>ADMIN</span>
            )}
          </div>

          <div className="flex gap-2.5 my-4.5">
            <div className="flex-1 rounded-2xl border p-3.5 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="serif text-[23px]" style={{ color: 'var(--k-ink)' }}>{myLogs.length}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Dives logged</div>
            </div>
            <div className="flex-1 rounded-2xl border p-3.5 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="serif text-[23px]" style={{ color: 'var(--k-ink)' }}>{sitesVisited}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Sites visited</div>
            </div>
            <div className="flex-1 rounded-2xl border p-3.5 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="serif text-[23px]" style={{ color: 'var(--k-ink)' }}>{myLogs.length}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Reports</div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border p-4 mb-4 flex items-center justify-between gap-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <div>
            <div className="serif text-[17px]" style={{ color: 'var(--k-ink)' }}>Not signed in</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Sign in to log dives and track your stats.</div>
          </div>
          <button onClick={onSignInClick} className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold text-white" style={{ background: '#15803D' }}>
            Sign in
          </button>
        </div>
      )}

      <SectionDivider label="Settings" />
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
        <Row label="Dark mode" onClick={toggleTheme}><Toggle checked={theme === 'dark'} onChange={toggleTheme} /></Row>
        <Row label="Push notifications"><Toggle checked onChange={() => {}} /></Row>
        <Row label="Temperature units"><span className="text-[14px]" style={{ color: 'var(--k-sub)' }}>°C</span></Row>
        <Row label="Share this app" onClick={() => setShowQr(true)} chevron />
        <Row label="Notifications & alerts" onClick={() => onNavigate('alerts')} chevron last={!isAdmin} />
        {isAdmin && <Row label="Admin panel" onClick={() => onNavigate('admin')} chevron last />}
      </div>

      {showQr && <ShareQrModal onClose={() => setShowQr(false)} />}

      {user && (
        <button
          onClick={logout}
          className="w-full rounded-2xl border py-3.5 mt-3.5 text-[14px] font-semibold"
          style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)', color: '#DC2626' }}
        >
          Sign out
        </button>
      )}
    </div>
  )
}

function Row({
  label, children, onClick, chevron, last,
}: {
  label: string
  children?: ReactNode
  onClick?: () => void
  chevron?: boolean
  last?: boolean
}) {
  // A plain div (not <button>) even when clickable, since children can include a real
  // interactive control (Toggle) — nesting a button inside a button is invalid HTML and
  // double-fires clicks via event bubbling.
  return (
    <div
      className="flex items-center justify-between px-4 py-[15px]"
      style={{ borderBottom: last ? undefined : '1px solid var(--k-hair)', cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <span className="text-[14px]" style={{ color: 'var(--k-ink2)' }}>{label}</span>
      {children}
      {chevron && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
      )}
    </div>
  )
}

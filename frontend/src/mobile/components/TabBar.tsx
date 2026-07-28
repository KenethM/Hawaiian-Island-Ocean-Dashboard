import type { MobileTab } from '../types'

const ICONS: Record<MobileTab, JSX.Element> = {
  reef: (
    <svg width="23" height="23" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M2 6c2.5-2 4.5-2 7 0s4.5 2 7 0 4-1.6 4-1.6" />
      <path d="M2 12c2.5-2 4.5-2 7 0s4.5 2 7 0 4-1.6 4-1.6" />
      <path d="M2 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4-1.6 4-1.6" />
    </svg>
  ),
  community: (
    <svg width="23" height="23" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M2.5 19c0-3 2.6-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="16" cy="9" r="2.3" />
      <path d="M15 14.2c2.7 0 4.5 1.9 4.5 4.8" />
    </svg>
  ),
  log: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 6v12M6 12h12" />
    </svg>
  ),
  ph: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />
    </svg>
  ),
  more: (
    <svg width="23" height="23" viewBox="0 0 22 22" fill="currentColor">
      <circle cx="6" cy="6" r="2.1" /><circle cx="15" cy="6" r="2.1" /><circle cx="6" cy="15" r="2.1" /><circle cx="15" cy="15" r="2.1" />
    </svg>
  ),
}

const LABELS: Record<MobileTab, string> = {
  reef: 'Reef', community: 'Community', log: 'Log', ph: 'Ocean pH', more: 'More',
}

export function TabBar({
  active, onChange, floating = false,
}: {
  active: MobileTab
  onChange: (tab: MobileTab) => void
  /** floating = translucent, sits over map content (Home screen) */
  floating?: boolean
}) {
  const order: MobileTab[] = ['reef', 'community', 'log', 'ph', 'more']

  return (
    <div
      className={`flex-shrink-0 h-[86px] flex items-start justify-around pt-[11px] border-t border-[var(--k-border)] ${
        floating ? 'bg-[var(--k-sheet)] backdrop-blur-xl' : 'bg-[var(--k-card)]'
      }`}
    >
      {order.map(tab => {
        const isActive = active === tab
        if (tab === 'log') {
          return (
            <button key={tab} onClick={() => onChange(tab)} className="flex flex-col items-center" aria-label="Log a dive">
              <div className="w-[54px] h-[54px] rounded-full bg-[#15803D] flex items-center justify-center -mt-5 shadow-[0_10px_20px_-6px_rgba(21,128,61,0.6)]">
                {ICONS.log}
              </div>
              <span className="text-[11px] mt-[3px] text-[var(--k-faint)]">{LABELS.log}</span>
            </button>
          )
        }
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`flex flex-col items-center gap-[3px] ${isActive ? 'text-[#15803D]' : 'text-[var(--k-faint)]'}`}
          >
            {ICONS[tab]}
            <span className={`text-[11px] ${isActive ? 'font-semibold' : ''}`}>{LABELS[tab]}</span>
          </button>
        )
      })}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { SectionDivider } from '../components/SectionDivider'
import { api } from '../../services/api'
import type { ReefSite, SiteSubscription, AlertHistoryEntry } from '../../types'

const LEVEL_COLOR: Record<number, string> = { 0: '#16A34A', 1: '#F59E0B', 2: '#DC2626', 3: '#DC2626', 4: '#DC2626' }
const LEVEL_ICON_BG: Record<number, string> = { 0: '#f0fdf4', 1: '#fffbeb', 2: '#fef2f2', 3: '#fef2f2', 4: '#fef2f2' }

export function AlertsScreen({ sites, onBack }: { sites: ReefSite[]; onBack: () => void }) {
  const [subs, setSubs] = useState<SiteSubscription[]>([])
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getSubscriptions().catch(() => []), api.getAlertHistory(undefined, 90).catch(() => [])])
      .then(([s, h]) => { setSubs(s); setHistory(h) })
      .finally(() => setLoading(false))
  }, [])

  async function toggle(siteId: string) {
    const existing = subs.find(s => s.reef_site_id === siteId)
    if (existing) {
      await api.unsubscribe(siteId)
      setSubs(prev => prev.filter(s => s.reef_site_id !== siteId))
    } else {
      const created = await api.subscribe(siteId)
      setSubs(prev => [...prev, created])
    }
  }

  const siteMap = Object.fromEntries(sites.map(s => [s.id, s]))

  return (
    <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
      <div className="flex items-center gap-2.5 mb-0.5">
        <button onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink)" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h2 className="serif text-[27px] font-medium" style={{ color: 'var(--k-ink)' }}>Alerts</h2>
      </div>
      <p className="text-[13px] mt-0.5 mb-2" style={{ color: 'var(--k-sub)' }}>Get notified when a reef you follow reaches a bleaching watch.</p>

      <SectionDivider label="Following" />
      {loading ? (
        <div className="text-center text-[12.5px] py-4" style={{ color: 'var(--k-sub)' }}>Loading…</div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          {subs.length === 0 ? (
            <div className="px-4 py-4 text-[13px]" style={{ color: 'var(--k-sub)' }}>
              You&rsquo;re not following any reefs yet — open a reef&rsquo;s detail page and tap &ldquo;Alert me&rdquo;.
            </div>
          ) : (
            subs.map((sub, i) => {
              const site = siteMap[sub.reef_site_id]
              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: i < subs.length - 1 ? '1px solid var(--k-hair)' : undefined }}
                >
                  <div>
                    <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>{site?.name ?? sub.reef_site_id}</div>
                    <div className="text-[12px]" style={{ color: 'var(--k-sub)' }}>Notify at Watch and above</div>
                  </div>
                  <Toggle checked onChange={() => toggle(sub.reef_site_id)} />
                </div>
              )
            })
          )}
        </div>
      )}

      <SectionDivider label="History" />
      <div className="flex flex-col gap-2.5">
        {history.length === 0 && (
          <div className="text-center text-[12.5px] py-4" style={{ color: 'var(--k-sub)' }}>No alert history yet.</div>
        )}
        {history.slice(0, 20).map(entry => (
          <div key={entry.id} className="flex gap-3 items-start rounded-2xl border px-3.5 py-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: LEVEL_ICON_BG[entry.alert_level] ?? '#f0fdf4' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={LEVEL_COLOR[entry.alert_level] ?? '#16A34A'} strokeWidth="2" strokeLinecap="round"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" /></svg>
            </span>
            <div className="flex-1">
              <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>
                {siteMap[entry.reef_site_id]?.name ?? entry.reef_site_id} — {entry.alert_label}
              </div>
              <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--k-sub)' }}>
                {entry.sst_c != null ? `SST ${entry.sst_c.toFixed(1)}°C. ` : ''}{new Date(entry.recorded_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

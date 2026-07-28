import { useEffect, useState } from 'react'
import { SectionDivider } from '../components/SectionDivider'
import { BleachingHistoryChart } from '../../components/Charts/BleachingHistoryChart'
import { ReportsOverTimeChart } from '../../components/Charts/ReportsOverTimeChart'
import { CommunityChart } from '../../components/Charts/CommunityChart'
import { api } from '../../services/api'
import type { ReefSite, SiteStat, DiverStatOverTime } from '../../types'
import type { DiverLogWithCoords } from '../../hooks/useDiverLogs'

const SEVERITY_COLOR: Record<string, string> = {
  none: '#16A34A', mild: '#F59E0B', moderate: '#F59E0B', severe: '#DC2626', mortality: '#DC2626',
}

export function CommunityScreen({
  sites, diverLogs, refreshKey = 0,
}: {
  sites: ReefSite[]
  diverLogs: DiverLogWithCoords[]
  refreshKey?: number
}) {
  const [stats, setStats] = useState<SiteStat[]>([])
  const [statsOverTime, setStatsOverTime] = useState<DiverStatOverTime[]>([])

  useEffect(() => {
    api.getDiverStatsBySite().then(setStats).catch(() => {})
    api.getDiverStatsOverTime().then(setStatsOverTime).catch(() => {})
  }, [refreshKey])

  const siteNames = Object.fromEntries(sites.map(s => [s.id, s.name]))
  const recent = diverLogs.slice(0, 6)

  return (
    <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="serif text-[27px] font-medium" style={{ color: 'var(--k-ink)' }}>Community reports</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Diver observations across all reef sites.</p>
        </div>
        <a
          href={api.exportDiverLogsCsv()}
          download
          className="flex-shrink-0 flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] font-semibold text-white mt-1"
          style={{ background: '#15803D' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 4v12M6 12l6 6 6-6" /></svg>
          CSV
        </a>
      </div>

      <SectionDivider label="Trends" />
      <div className="rounded-2xl border p-4" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
        <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Bleaching & coral cover</div>
        <div className="text-[11px] mb-1" style={{ color: 'var(--k-sub)' }}>Avg % from diver reports · last 6 months</div>
        <BleachingHistoryChart data={statsOverTime} />
      </div>
      <div className="rounded-2xl border p-4 mt-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
        <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink2)' }}>Reports over time</div>
        <div className="text-[11px] mb-1" style={{ color: 'var(--k-sub)' }}>Reports per day · last 12 weeks</div>
        <ReportsOverTimeChart data={statsOverTime} />
      </div>

      <SectionDivider label="Reports by site" />
      <div className="rounded-2xl border p-4" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
        <CommunityChart stats={stats} siteNames={siteNames} />
      </div>

      <SectionDivider label="Recent observations" />
      <div className="flex flex-col gap-2.5">
        {recent.length === 0 && (
          <div className="text-center text-[12.5px] py-4" style={{ color: 'var(--k-sub)' }}>No diver reports yet — be the first to log a dive.</div>
        )}
        {recent.map(log => (
          <div key={log.id} className="flex gap-3 items-start rounded-2xl border px-3.5 py-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: SEVERITY_COLOR[log.bleaching_severity ?? 'none'] }} />
            <div className="flex-1">
              <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>
                {log.siteName} <span className="font-normal text-[12px]" style={{ color: 'var(--k-sub)' }}>· {log.diver_name || 'Anonymous'} · {new Date(log.submitted_at).toLocaleDateString()}</span>
              </div>
              {log.general_notes && <div className="serif text-[14px] mt-0.5" style={{ color: 'var(--k-ink2)' }}>&ldquo;{log.general_notes}&rdquo;</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

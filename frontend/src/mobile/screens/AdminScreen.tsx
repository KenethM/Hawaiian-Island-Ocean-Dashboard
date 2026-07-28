import { useEffect, useRef, useState } from 'react'
import { SectionDivider } from '../components/SectionDivider'
import { api } from '../../services/api'
import type { ReefSiteAdmin, AlertHistoryEntry, AuditLogEntry } from '../../types'

type SubView = 'hub' | 'sites' | 'alerts' | 'audit'

const ALERT_COLORS: Record<number, string> = { 0: '#16A34A', 1: '#F59E0B', 2: '#DC2626', 3: '#DC2626', 4: '#DC2626' }

function BackRow({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <button onClick={onBack} aria-label="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink)" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h2 className="serif text-[22px]" style={{ color: 'var(--k-ink)' }}>{title}</h2>
    </div>
  )
}

export function AdminScreen({ onBack }: { onBack: () => void }) {
  const [sub, setSub] = useState<SubView>('hub')
  const [sites, setSites] = useState<ReefSiteAdmin[]>([])
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([])
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [reportCount, setReportCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadResult, setUploadResult] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.getAdminSites().then(setSites).catch(() => {})
    api.getDiverStatsBySite().then(stats => setReportCount(stats.reduce((s, r) => s + r.count, 0))).catch(() => {})
  }, [])

  useEffect(() => {
    if (sub === 'alerts') api.getAlertHistory(undefined, 90).then(setAlertHistory).catch(() => {})
    if (sub === 'audit') api.getAuditLog(undefined, 30).then(setAuditLog).catch(() => {})
  }, [sub])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await api.uploadPhCsv('hot', 'observed', 'Station ALOHA', null, null, file)
      setUploadResult(`Imported ${res.inserted} rows (${res.skipped} skipped).`)
    } catch {
      setUploadResult('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  if (sub === 'sites') {
    return (
      <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
        <BackRow title="Reef sites" onBack={() => setSub('hub')} />
        <div className="flex flex-col gap-2.5">
          {sites.map(s => (
            <div key={s.id} className="rounded-2xl border px-4 py-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>{s.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.is_active ? '' : ''}`} style={{ background: s.is_active ? '#e6f5ec' : 'var(--k-hair)', color: s.is_active ? '#15803D' : 'var(--k-sub)' }}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--k-sub)' }}>{s.island} · {s.lat.toFixed(3)}, {s.lng.toFixed(3)} · MMM {s.mmm_c}°C</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (sub === 'alerts') {
    return (
      <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
        <BackRow title="Alert history" onBack={() => setSub('hub')} />
        <div className="flex flex-col gap-2.5">
          {alertHistory.length === 0 && <div className="text-center text-[12.5px] py-4" style={{ color: 'var(--k-sub)' }}>No alert history yet.</div>}
          {alertHistory.slice(0, 30).map(e => (
            <div key={e.id} className="rounded-2xl border px-4 py-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-white rounded-full px-2 py-0.5" style={{ background: ALERT_COLORS[e.alert_level] ?? '#6b7280' }}>{e.alert_label}</span>
                <span className="font-semibold text-[13.5px]" style={{ color: 'var(--k-ink)' }}>{e.reef_site_id}</span>
              </div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--k-sub)' }}>{new Date(e.recorded_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (sub === 'audit') {
    return (
      <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
        <BackRow title="Audit log" onBack={() => setSub('hub')} />
        <div className="flex flex-col gap-2.5">
          {auditLog.length === 0 && <div className="text-center text-[12.5px] py-4" style={{ color: 'var(--k-sub)' }}>No audit log entries yet.</div>}
          {auditLog.slice(0, 30).map(e => (
            <div key={e.id} className="rounded-2xl border px-4 py-3" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
              <div className="font-mono text-[12px]" style={{ color: 'var(--k-ink)' }}>{e.action}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--k-sub)' }}>{e.user_email ?? 'system'} · {new Date(e.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
      <div className="flex items-center gap-2.5">
        <button onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--k-ink)" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <h2 className="serif text-[27px] font-medium" style={{ color: 'var(--k-ink)' }}>Admin</h2>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: '#fef3c7', color: '#b45309' }}>ADMIN</span>
      </div>
      <p className="text-[13px] mt-1.5 mb-4.5" style={{ color: 'var(--k-sub)' }}>Manage sites, review activity, and upload ocean chemistry data.</p>

      <div className="flex gap-2.5 mb-4.5">
        <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'var(--k-panel)' }}>
          <div className="serif text-[23px] text-white">—</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-faint)' }}>Members</div>
        </div>
        <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'var(--k-panel)' }}>
          <div className="serif text-[23px] text-white">{reportCount ?? '—'}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-faint)' }}>Reports</div>
        </div>
        <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'var(--k-panel)' }}>
          <div className="serif text-[23px] text-white">{sites.length}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-faint)' }}>Sites</div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <AdminRow icon="sites" title="Reef sites" subtitle="View sites and MMM baselines" onClick={() => setSub('sites')} />
        <AdminRow icon="alerts" title="Alert history" subtitle={`${alertHistory.length || '—'} alerts sent`} onClick={() => setSub('alerts')} />
        <AdminRow icon="audit" title="Audit log" subtitle="Recent admin actions" onClick={() => setSub('audit')} />
      </div>

      <SectionDivider label="Ocean pH data" />
      <div className="rounded-2xl border p-4" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
        <label className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed px-4 py-4.5 text-[13px] cursor-pointer" style={{ borderColor: 'var(--k-line)', color: 'var(--k-sub)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></svg>
          {uploading ? 'Uploading…' : 'Upload CSV'}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
        </label>
        <div className="text-[11.5px] mt-2.5 leading-[1.6]" style={{ color: 'var(--k-sub)' }}>
          Requires columns <span className="font-mono">measured_at</span>, <span className="font-mono">ph</span>.
          {uploadResult && <div className="mt-1 font-semibold" style={{ color: 'var(--k-ink2)' }}>{uploadResult}</div>}
        </div>
      </div>
    </div>
  )
}

function AdminRow({ title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
      <span className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: '#e6f5ec' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round"><path d="M4 5h16M4 12h16M4 19h10" /></svg>
      </span>
      <div className="flex-1">
        <div className="font-semibold text-[14px]" style={{ color: 'var(--k-ink)' }}>{title}</div>
        <div className="text-[12px]" style={{ color: 'var(--k-sub)' }}>{subtitle}</div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import type { ReefSiteAdmin, AuditLogEntry, AlertHistoryEntry } from '../types'

type AdminTab = 'sites' | 'audit' | 'alerts'

function SiteRow({
  site,
  onEdit,
  onDelete,
}: {
  site: ReefSiteAdmin
  onEdit: (s: ReefSiteAdmin) => void
  onDelete: (id: string) => void
}) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 text-sm font-mono text-gray-600">{site.id}</td>
      <td className="px-3 py-2 text-sm font-medium text-gray-800">{site.name}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{site.island}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{site.lat.toFixed(4)}, {site.lng.toFixed(4)}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{site.depth_m}m</td>
      <td className="px-3 py-2 text-sm text-gray-600">{site.mmm_c}°C</td>
      <td className="px-3 py-2">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${site.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {site.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <button onClick={() => onEdit(site)} className="text-xs text-ocean-700 hover:text-ocean-900 font-medium">Edit</button>
          <button onClick={() => onDelete(site.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
        </div>
      </td>
    </tr>
  )
}

function SiteFormModal({
  site,
  onSave,
  onClose,
}: {
  site: Partial<ReefSiteAdmin> | null
  onSave: (data: Partial<ReefSiteAdmin>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<ReefSiteAdmin>>(site ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof ReefSiteAdmin, v: string | number | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">{site?.id ? 'Edit Site' : 'New Site'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{error}</div>}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {!site?.id && (
              <div className="col-span-2">
                <label className="block font-medium text-gray-700 mb-1">ID (snake_case)</label>
                <input type="text" value={form.id ?? ''} onChange={e => set('id', e.target.value)} placeholder="e.g. new_reef_site" className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={form.name ?? ''} onChange={e => set('name', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Island</label>
              <input type="text" value={form.island ?? ''} onChange={e => set('island', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Depth (m)</label>
              <input type="number" step="0.1" value={form.depth_m ?? ''} onChange={e => set('depth_m', Number(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Latitude</label>
              <input type="number" step="0.0001" value={form.lat ?? ''} onChange={e => set('lat', Number(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Longitude</label>
              <input type="number" step="0.0001" value={form.lng ?? ''} onChange={e => set('lng', Number(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">MMM Temp (°C)</label>
              <input type="number" step="0.1" value={form.mmm_c ?? ''} onChange={e => set('mmm_c', Number(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
            </div>
            <div className="col-span-2">
              <label className="block font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 resize-none text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-md py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-ocean-700 text-white rounded-md py-2 text-sm font-semibold hover:bg-ocean-900 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Site'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('sites')
  const [sites, setSites] = useState<ReefSiteAdmin[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [editingSite, setEditingSite] = useState<Partial<ReefSiteAdmin> | null | false>(false)

  const loadSites = useCallback(() => {
    setLoading(true)
    api.getAdminSites()
      .then(setSites)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadAudit = useCallback(() => {
    setLoading(true)
    api.getAuditLog(undefined, 30)
      .then(setAuditLogs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadAlertHistory = useCallback(() => {
    setLoading(true)
    api.getAlertHistory(undefined, 90)
      .then(setAlertHistory)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'sites') loadSites()
    else if (tab === 'audit') loadAudit()
    else if (tab === 'alerts') loadAlertHistory()
  }, [tab, loadSites, loadAudit, loadAlertHistory])

  async function handleSaveSite(data: Partial<ReefSiteAdmin>) {
    if (data.id && sites.find(s => s.id === data.id)) {
      await api.updateAdminSite(data.id, data)
    } else {
      await api.createAdminSite(data as Omit<ReefSiteAdmin, 'is_active' | 'created_at'>)
    }
    loadSites()
  }

  async function handleDeleteSite(id: string) {
    if (!confirm(`Delete site "${id}"? This cannot be undone.`)) return
    await api.deleteAdminSite(id)
    loadSites()
  }

  const ALERT_COLORS: Record<number, string> = {
    0: '#22c55e', 1: '#f97316', 2: '#ef4444', 3: '#dc2626', 4: '#7f1d1d'
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
        {tab === 'sites' && (
          <button
            onClick={() => setEditingSite({})}
            className="bg-ocean-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-ocean-900"
          >
            + Add Site
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {([['sites', 'Reef Sites'], ['alerts', 'Alert History'], ['audit', 'Audit Log']] as [AdminTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'border-b-2 border-ocean-700 text-ocean-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>}

      {/* Sites table */}
      {tab === 'sites' && !loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {['ID', 'Name', 'Island', 'Coordinates', 'Depth', 'MMM', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map(s => (
                <SiteRow key={s.id} site={s} onEdit={s => setEditingSite(s)} onDelete={handleDeleteSite} />
              ))}
            </tbody>
          </table>
          {sites.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">No sites found</p>}
        </div>
      )}

      {/* Alert history */}
      {tab === 'alerts' && !loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {['Site', 'Alert Level', 'SST', 'DHW', 'Recorded At'].map(h => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertHistory.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-mono text-gray-600">{r.reef_site_id}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: ALERT_COLORS[r.alert_level] ?? '#6b7280' }}>
                      {r.alert_label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">{r.sst_c != null ? `${r.sst_c.toFixed(1)}°C` : '—'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{r.dhw != null ? `${r.dhw.toFixed(1)}` : '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.recorded_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {alertHistory.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">No alert history yet — history is recorded when bleaching alerts are active during the notification check cycle.</p>}
        </div>
      )}

      {/* Audit log */}
      {tab === 'audit' && !loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {['User', 'Action', 'Resource', 'Details', 'Time'].map(h => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-600">{r.user_email ?? '—'}</td>
                  <td className="px-3 py-2"><span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{r.action}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{[r.resource_type, r.resource_id].filter(Boolean).join(' / ')}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">
                    {r.details ? JSON.stringify(r.details) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLogs.length === 0 && <p className="text-gray-400 text-sm py-6 text-center">No audit log entries yet.</p>}
        </div>
      )}

      {/* Site edit/create modal */}
      {editingSite !== false && (
        <SiteFormModal
          site={editingSite}
          onSave={handleSaveSite}
          onClose={() => setEditingSite(false)}
        />
      )}
    </div>
  )
}

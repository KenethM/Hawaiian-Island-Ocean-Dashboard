import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { ReefSite } from '../../types'

const CLARITY_OPTIONS = [
  { label: 'Poor', visibility_m: 3 },
  { label: 'Fair', visibility_m: 8 },
  { label: 'Good', visibility_m: 15 },
  { label: 'Great', visibility_m: 25 },
]

export function LogDiveScreen({
  sites, onSubmitted, onSignInClick,
}: {
  sites: ReefSite[]
  onSubmitted: () => void
  onSignInClick: () => void
}) {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [date, setDate] = useState(today)
  const [depth, setDepth] = useState(12)
  const [bleaching, setBleaching] = useState(15)
  const [coralCover, setCoralCover] = useState(62)
  const [clarity, setClarity] = useState(2)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const site = sites.find(s => s.id === siteId)

  async function handleSubmit() {
    if (!user) { onSignInClick(); return }
    if (!siteId) { setError('Choose a site first.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.submitDiverLog({
        reef_site_id: siteId,
        dive_date: date,
        depth_m: depth,
        bleaching_pct: bleaching,
        coral_cover_pct: coralCover,
        visibility_m: CLARITY_OPTIONS[clarity].visibility_m,
        general_notes: notes || undefined,
      })
      setSuccess(true)
      setNotes('')
      onSubmitted()
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const labelCls = 'text-[12px] font-bold tracking-[0.05em] uppercase'

  return (
    <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
      <h2 className="serif text-[27px] font-medium" style={{ color: 'var(--k-ink)' }}>Log a dive</h2>
      <p className="text-[13px] mt-0.5 mb-4" style={{ color: 'var(--k-sub)' }}>Help track reef health. Your report is shared with the community.</p>

      {success && (
        <div className="rounded-xl px-3.5 py-2.5 mb-4 text-[13px]" style={{ background: '#e6f5ec', color: '#15803D' }}>Observation submitted — mahalo!</div>
      )}
      {error && (
        <div className="rounded-xl px-3.5 py-2.5 mb-4 text-[13px]" style={{ background: '#fef2f2', color: '#DC2626' }}>{error}</div>
      )}

      <label className={labelCls} style={{ color: '#15803D' }}>Site</label>
      <select
        value={siteId}
        onChange={e => setSiteId(e.target.value)}
        className="serif w-full flex items-center justify-between rounded-[14px] border px-4 py-3.5 mt-1.5 mb-4 text-[16px] appearance-none"
        style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)', color: 'var(--k-ink)' }}
      >
        {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.island})</option>)}
      </select>

      <label className={labelCls} style={{ color: '#15803D' }}>Date &amp; depth</label>
      <div className="flex gap-2.5 mt-1.5 mb-4">
        <input
          type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          className="flex-1 rounded-[14px] border px-3.5 py-3.5 text-[15px]"
          style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)', color: 'var(--k-ink)' }}
        />
        <div className="flex-1 flex items-center justify-between rounded-[14px] border px-3.5 py-3.5" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <input
            type="number" min={0} max={200} value={depth} onChange={e => setDepth(Number(e.target.value))}
            className="w-12 text-[15px] bg-transparent outline-none" style={{ color: 'var(--k-ink)' }}
          />
          <span className="text-[12px]" style={{ color: 'var(--k-sub)' }}>m depth</span>
        </div>
      </div>

      <label className={labelCls} style={{ color: '#15803D' }}>Bleaching</label>
      <div className="flex items-center gap-3 mt-2 mb-4">
        <input type="range" min={0} max={100} value={bleaching} onChange={e => setBleaching(Number(e.target.value))} className="flex-1 accent-[#F59E0B]" />
        <span className="serif text-[17px] w-11 text-right" style={{ color: 'var(--k-ink)' }}>{bleaching}%</span>
      </div>

      <label className={labelCls} style={{ color: '#15803D' }}>Coral cover</label>
      <div className="flex items-center gap-3 mt-2 mb-4">
        <input type="range" min={0} max={100} value={coralCover} onChange={e => setCoralCover(Number(e.target.value))} className="flex-1 accent-[#16A34A]" />
        <span className="serif text-[17px] w-11 text-right" style={{ color: 'var(--k-ink)' }}>{coralCover}%</span>
      </div>

      <label className={labelCls} style={{ color: '#15803D' }}>Water clarity</label>
      <div className="flex gap-1.5 mt-2 mb-4">
        {CLARITY_OPTIONS.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => setClarity(i)}
            className="flex-1 text-center py-2.5 rounded-[10px] border text-[12.5px]"
            style={
              clarity === i
                ? { background: '#0f766e', borderColor: '#0f766e', color: '#fff', fontWeight: 600 }
                : { background: 'var(--k-card)', borderColor: 'var(--k-border)', color: 'var(--k-sub)' }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className={labelCls} style={{ color: '#15803D' }}>Notes</label>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Species seen, coral condition, anything notable…"
        rows={3}
        className="serif w-full rounded-[14px] border px-4 py-3.5 mt-1.5 mb-4 text-[15px] resize-none"
        style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)', color: 'var(--k-ink)' }}
      />

      <div
        className="flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed px-4 py-4.5 text-[13px] mb-5"
        style={{ borderColor: 'var(--k-line)', color: 'var(--k-sub)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 8l2-3h12l2 3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        Add a photo
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !site}
        className="w-full rounded-[14px] py-4 text-[15px] font-semibold text-white disabled:opacity-60"
        style={{ background: '#15803D', boxShadow: '0 8px 18px -8px rgba(21,128,61,0.7)' }}
      >
        {submitting ? 'Submitting…' : user ? 'Submit observation' : 'Sign in to submit'}
      </button>
    </div>
  )
}

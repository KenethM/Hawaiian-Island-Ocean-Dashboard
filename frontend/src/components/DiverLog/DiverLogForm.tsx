import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import type { DiverLogCreate, BleachingSeverity, ReefSite, SpeciesSightingCreate } from '../../types'

interface Props {
  sites: ReefSite[]
  defaultSiteId?: string
  onSubmitted: () => void
  onSignInClick?: () => void
}

const SEVERITY_OPTIONS: BleachingSeverity[] = ['none', 'mild', 'moderate', 'severe', 'mortality']

const inputCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 focus:outline-none'
const labelCls = 'block font-medium text-gray-700 dark:text-slate-300 mb-1'

function SpeciesTracker({
  sightings,
  onChange,
}: {
  sightings: SpeciesSightingCreate[]
  onChange: (s: SpeciesSightingCreate[]) => void
}) {
  const add = () => onChange([...sightings, { species_name: '' }])
  const remove = (i: number) => onChange(sightings.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<SpeciesSightingCreate>) =>
    onChange(sightings.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const smallInput = 'border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-400'

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <label className={labelCls}>Species Sightings</label>
        <button
          type="button"
          onClick={add}
          className="text-xs text-ocean-700 dark:text-ocean-400 hover:text-ocean-900 font-medium"
        >
          + Add species
        </button>
      </div>
      {sightings.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">No species added yet</p>
      ) : (
        <div className="space-y-2">
          {sightings.map((s, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Species name"
                value={s.species_name}
                onChange={e => update(i, { species_name: e.target.value })}
                className={`flex-1 ${smallInput}`}
              />
              <input
                type="number"
                placeholder="#"
                min={1}
                value={s.count ?? ''}
                onChange={e => update(i, { count: e.target.value ? Number(e.target.value) : undefined })}
                className={`w-16 ${smallInput}`}
              />
              <input
                type="text"
                placeholder="Notes"
                value={s.notes ?? ''}
                onChange={e => update(i, { notes: e.target.value || undefined })}
                className={`flex-1 ${smallInput}`}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DiverLogForm({ sites, defaultSiteId, onSubmitted, onSignInClick }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const { user } = useAuth()
  const [form, setForm] = useState<DiverLogCreate>({
    reef_site_id: defaultSiteId ?? '',
    dive_date: today,
    diver_name: user?.full_name ?? undefined,
  })
  const [species, setSpecies] = useState<SpeciesSightingCreate[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (defaultSiteId !== undefined) {
      setForm(prev => ({ ...prev, reef_site_id: defaultSiteId }))
    }
  }, [defaultSiteId])

  const set = (key: keyof DiverLogCreate, value: string | number | undefined) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload: DiverLogCreate = {
        ...form,
        species_sightings: species.filter(s => s.species_name.trim()),
      }
      await api.submitDiverLog(payload)
      setSuccess(true)
      setForm({ reef_site_id: defaultSiteId ?? '', dive_date: today })
      setSpecies([])
      onSubmitted()
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-gray-600 dark:text-slate-400 text-sm">Sign in to submit a dive observation.</p>
        <button
          type="button"
          onClick={onSignInClick}
          className="bg-ocean-700 text-white px-5 py-2 rounded-md font-semibold text-sm hover:bg-ocean-900 transition-colors"
        >
          Sign In / Create Account
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-md px-3 py-2">
          Observation submitted — mahalo!
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Reef Site *</label>
          <select
            required
            value={form.reef_site_id}
            onChange={e => set('reef_site_id', e.target.value)}
            className={inputCls}
          >
            <option value="">— select a site —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.island})</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Dive Date *</label>
          <input
            required
            type="date"
            value={form.dive_date}
            max={today}
            onChange={e => set('dive_date', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Your Name</label>
          <input
            type="text"
            placeholder="Optional"
            value={form.diver_name ?? ''}
            onChange={e => set('diver_name', e.target.value || undefined)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Depth (m)</label>
          <input
            type="number" min={0} max={200} step={0.5}
            value={form.depth_m ?? ''}
            onChange={e => set('depth_m', e.target.value ? Number(e.target.value) : undefined)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Water Temp (°C)</label>
          <input
            type="number" min={15} max={35} step={0.1}
            value={form.water_temp_c ?? ''}
            onChange={e => set('water_temp_c', e.target.value ? Number(e.target.value) : undefined)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Visibility (m)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={form.visibility_m ?? ''}
            onChange={e => set('visibility_m', e.target.value ? Number(e.target.value) : undefined)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Coral Cover (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={form.coral_cover_pct ?? ''}
            onChange={e => set('coral_cover_pct', e.target.value ? Number(e.target.value) : undefined)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Bleaching (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={form.bleaching_pct ?? ''}
            onChange={e => set('bleaching_pct', e.target.value ? Number(e.target.value) : undefined)}
            className={inputCls}
          />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Bleaching Severity</label>
          <div className="flex gap-2 flex-wrap">
            {SEVERITY_OPTIONS.map(sev => (
              <button
                key={sev}
                type="button"
                onClick={() => set('bleaching_severity', form.bleaching_severity === sev ? undefined : sev)}
                className={`px-3 py-1 rounded-full border text-xs capitalize transition-colors ${
                  form.bleaching_severity === sev
                    ? 'bg-ocean-700 text-white border-ocean-700'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-ocean-500'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <SpeciesTracker sightings={species} onChange={setSpecies} />

        <div className="col-span-2">
          <label className={labelCls}>Species Notes</label>
          <textarea
            rows={2}
            placeholder="e.g. Acropora bleaching on south wall, Porites healthy"
            value={form.species_notes ?? ''}
            onChange={e => set('species_notes', e.target.value || undefined)}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>General Notes</label>
          <textarea
            rows={2}
            placeholder="Anything else worth noting about this dive"
            value={form.general_notes ?? ''}
            onChange={e => set('general_notes', e.target.value || undefined)}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-ocean-700 text-white py-2 rounded-md font-semibold hover:bg-ocean-900 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit Observation'}
      </button>
    </form>
  )
}

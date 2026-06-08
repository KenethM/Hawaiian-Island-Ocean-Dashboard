import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../services/api'
import type { DiverLogCreate, BleachingSeverity, ReefSite } from '../../types'

interface Props {
  sites: ReefSite[]
  defaultSiteId?: string
  onSubmitted: () => void
}

const SEVERITY_OPTIONS: BleachingSeverity[] = ['none', 'mild', 'moderate', 'severe', 'mortality']

export function DiverLogForm({ sites, defaultSiteId, onSubmitted }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<DiverLogCreate>({
    reef_site_id: defaultSiteId ?? '',
    dive_date: today,
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof DiverLogCreate, value: string | number | undefined) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.submitDiverLog(form)
      setSuccess(true)
      setForm({ reef_site_id: defaultSiteId ?? '', dive_date: today })
      onSubmitted()
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-700 rounded-md px-3 py-2">
          Observation submitted — mahalo!
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block font-medium text-gray-700 mb-1">Reef Site *</label>
          <select
            required
            value={form.reef_site_id}
            onChange={e => set('reef_site_id', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
          >
            <option value="">— select a site —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.island})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Dive Date *</label>
          <input
            required
            type="date"
            value={form.dive_date}
            max={today}
            onChange={e => set('dive_date', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Your Name</label>
          <input
            type="text"
            placeholder="Optional"
            value={form.diver_name ?? ''}
            onChange={e => set('diver_name', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Depth (m)</label>
          <input
            type="number" min={0} max={200} step={0.5}
            value={form.depth_m ?? ''}
            onChange={e => set('depth_m', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Water Temp (°C)</label>
          <input
            type="number" min={15} max={35} step={0.1}
            value={form.water_temp_c ?? ''}
            onChange={e => set('water_temp_c', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Visibility (m)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={form.visibility_m ?? ''}
            onChange={e => set('visibility_m', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Coral Cover (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={form.coral_cover_pct ?? ''}
            onChange={e => set('coral_cover_pct', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Bleaching (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={form.bleaching_pct ?? ''}
            onChange={e => set('bleaching_pct', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <div className="col-span-2">
          <label className="block font-medium text-gray-700 mb-1">Bleaching Severity</label>
          <div className="flex gap-2 flex-wrap">
            {SEVERITY_OPTIONS.map(sev => (
              <button
                key={sev}
                type="button"
                onClick={() => set('bleaching_severity', sev)}
                className={`px-3 py-1 rounded-full border text-xs capitalize transition-colors ${
                  form.bleaching_severity === sev
                    ? 'bg-ocean-700 text-white border-ocean-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-ocean-500'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <label className="block font-medium text-gray-700 mb-1">Species Notes</label>
          <textarea
            rows={2}
            placeholder="e.g. Acropora bleaching on south wall, Porites healthy"
            value={form.species_notes ?? ''}
            onChange={e => set('species_notes', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 resize-none"
          />
        </div>

        <div className="col-span-2">
          <label className="block font-medium text-gray-700 mb-1">General Notes</label>
          <textarea
            rows={2}
            placeholder="Anything else worth noting about this dive"
            value={form.general_notes ?? ''}
            onChange={e => set('general_notes', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 resize-none"
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

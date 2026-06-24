import { useState, useRef, type FormEvent } from 'react'
import { usePhData } from '../hooks/usePhData'
import { PhRawChart, PhPredictionChart, SOURCE_META } from './Charts/PhChart'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const SOURCE_ORDER = ['hot', 'cmems', 'ipacoa', 'dar_reef_check']
const YEAR_OPTIONS = [10, 20, 30] as const

interface Props {
  onSignInClick?: () => void
}

export function PhDashboard({ onSignInClick }: Props) {
  const [years, setYears] = useState<number>(30)
  const {
    mode, setMode,
    selectedSources, toggleSource,
    trendData, prediction,
    sourceInfo,
    loadingTrend, loadingPrediction,
    trendError, predictionError,
  } = usePhData(years)

  const { user } = useAuth()
  const [uploadTab, setUploadTab] = useState(false)
  const [uploadSource, setUploadSource] = useState('hot')
  const [uploadDataType, setUploadDataType] = useState('observed')
  const [uploadLocation, setUploadLocation] = useState('')
  const [uploadLat, setUploadLat] = useState('')
  const [uploadLng, setUploadLng] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [cmemsFetching, setCmemsFetching] = useState(false)
  const [cmemsFetchResult, setCmemsFetchResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [cmemsFetchError, setCmemsFetchError] = useState<string | null>(null)

  const sourceCountMap = Object.fromEntries(
    sourceInfo.map(s => [s.source, s])
  )

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    setUploadError(null)
    try {
      const result = await api.uploadPhCsv(
        uploadSource,
        uploadDataType,
        uploadLocation,
        uploadLat ? parseFloat(uploadLat) : null,
        uploadLng ? parseFloat(uploadLng) : null,
        file,
      )
      setUploadResult(result)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleFetchCmems() {
    setCmemsFetching(true)
    setCmemsFetchResult(null)
    setCmemsFetchError(null)
    try {
      const result = await api.fetchCmems('2015-01-01')
      setCmemsFetchResult(result)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setCmemsFetchError(typeof detail === 'string' ? detail : 'CMEMS fetch failed')
    } finally {
      setCmemsFetching(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Ocean pH Dashboard</h2>
        <p className="text-sm text-gray-500">
          Aggregated ocean acidification data from multiple sources. Hawaiian waters have declined from
          ~8.18 (pre-industrial) toward current levels. Toggle sources and modes to explore.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setMode('raw')}
            className={`px-4 py-2 font-medium transition-colors ${
              mode === 'raw' ? 'bg-ocean-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Raw Data
          </button>
          <button
            onClick={() => setMode('prediction')}
            className={`px-4 py-2 font-medium transition-colors ${
              mode === 'prediction' ? 'bg-ocean-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Model + Prediction
          </button>
        </div>

        {/* Year range selector */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium">Range:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {YEAR_OPTIONS.map(y => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`px-3 py-2 font-medium transition-colors ${
                  years === y ? 'bg-ocean-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {y}yr
              </button>
            ))}
          </div>
        </div>

        {/* Source toggles (only in raw mode) */}
        {mode === 'raw' && (
          <div className="flex flex-wrap gap-2">
            {SOURCE_ORDER.map(src => {
              const meta = SOURCE_META[src]
              const info = sourceCountMap[src]
              const active = selectedSources.includes(src)
              const hasData = info && info.count > 0
              return (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  title={meta.desc}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active && hasData
                      ? 'text-white border-transparent'
                      : active && !hasData
                      ? 'border-dashed text-gray-500 bg-gray-50'
                      : 'bg-white text-gray-400 border-gray-200'
                  }`}
                  style={active && hasData ? { background: meta.color, borderColor: meta.color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: meta.color }}
                  />
                  {meta.label}
                  {info ? <span className="opacity-70">({info.count.toLocaleString()})</span> : <span className="opacity-40">(no data)</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Main chart card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        {mode === 'raw' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-700 text-sm">pH Over Time — Raw Data</h3>
                <p className="text-xs text-gray-400">Monthly averages per source · last {years} years</p>
              </div>
            </div>
            {loadingTrend ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading pH data…</div>
            ) : trendError ? (
              <div className="h-64 flex items-center justify-center text-red-400 text-sm">{trendError}</div>
            ) : (
              <PhRawChart data={trendData} activeSources={selectedSources} />
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-700 text-sm">pH Trend + Forecast</h3>
                <p className="text-xs text-gray-400">
                  Based on HOT Station ALOHA observed data · Linear + seasonal model · 24-month outlook
                </p>
              </div>
            </div>
            {loadingPrediction ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Running model…</div>
            ) : predictionError ? (
              <div className="h-64 flex items-center justify-center text-center text-sm">
                <div>
                  <p className="text-red-500 font-medium mb-1">Prediction unavailable</p>
                  <p className="text-gray-400 text-xs">{predictionError}</p>
                </div>
              </div>
            ) : prediction ? (
              <PhPredictionChart prediction={prediction} rawHot={trendData} />
            ) : null}
          </>
        )}
      </div>

      {/* Source status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {SOURCE_ORDER.map(src => {
          const meta = SOURCE_META[src]
          const info = sourceCountMap[src]
          return (
            <div key={src} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                <p className="text-xs font-semibold text-gray-700 truncate">{meta.label}</p>
              </div>
              <p className="text-xs text-gray-400 mb-2">{meta.desc}</p>
              {info ? (
                <p className="text-xs text-gray-600">
                  <strong>{info.count.toLocaleString()}</strong> records<br />
                  {info.earliest} → {info.latest}
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic">No data yet</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Admin data tools */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setUploadTab(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Data Tools (Admin)</span>
          <span className="text-gray-400">{uploadTab ? '▲' : '▼'}</span>
        </button>

        {uploadTab && (
          <div className="border-t border-gray-200 p-5 space-y-6">
            {!user ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">Sign in with an admin account to manage pH data.</p>
                <button
                  onClick={onSignInClick}
                  className="text-sm bg-ocean-700 text-white px-4 py-2 rounded-md hover:bg-ocean-800 transition-colors"
                >
                  Sign in
                </button>
              </div>
            ) : !user.is_admin ? (
              <p className="text-sm text-gray-400 text-center py-4">Admin access required to use data tools.</p>
            ) : (
              <>
                {/* CMEMS satellite pull */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Pull CMEMS Satellite Data</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Fetches modeled pH from Copernicus Marine Service for the Hawaiian region (2015–present).
                    Requires <code className="bg-gray-100 px-1 rounded">CMEMS_USER</code> and{' '}
                    <code className="bg-gray-100 px-1 rounded">CMEMS_PASSWORD</code> env vars on the server.
                    This may take 1–3 minutes.
                  </p>
                  <button
                    onClick={handleFetchCmems}
                    disabled={cmemsFetching}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {cmemsFetching ? 'Fetching… (this may take a minute)' : 'Fetch CMEMS Data'}
                  </button>
                  {cmemsFetchResult && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-md px-4 py-2 text-sm text-green-700">
                      Imported <strong>{cmemsFetchResult.inserted}</strong> records
                      {cmemsFetchResult.skipped > 0 && `, skipped ${cmemsFetchResult.skipped} duplicates`}
                    </div>
                  )}
                  {cmemsFetchError && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-md px-4 py-2 text-sm text-red-600">
                      {cmemsFetchError}
                    </div>
                  )}
                </div>

                <hr className="border-gray-100" />

                {/* CSV upload */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Upload CSV Data</h4>
                  <p className="text-xs text-gray-500 mb-4">
                    CSV must have columns: <code className="bg-gray-100 px-1 rounded">measured_at</code> (ISO date) and{' '}
                    <code className="bg-gray-100 px-1 rounded">ph</code>. Optional:{' '}
                    <code className="bg-gray-100 px-1 rounded">pco2</code>,{' '}
                    <code className="bg-gray-100 px-1 rounded">aragonite_sat</code>. Max 10 MB.
                  </p>
                  <form onSubmit={handleUpload} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Source</label>
                        <select
                          value={uploadSource}
                          onChange={e => setUploadSource(e.target.value)}
                          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                        >
                          <option value="hot">HOT / Station ALOHA</option>
                          <option value="cmems">CMEMS</option>
                          <option value="ipacoa">IPACOA</option>
                          <option value="dar_reef_check">DAR / Reef Check</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Data type</label>
                        <select
                          value={uploadDataType}
                          onChange={e => setUploadDataType(e.target.value)}
                          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                        >
                          <option value="observed">Observed</option>
                          <option value="modeled">Modeled</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Location name</label>
                      <input
                        type="text"
                        value={uploadLocation}
                        onChange={e => setUploadLocation(e.target.value)}
                        placeholder="e.g. Station ALOHA"
                        className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Latitude (optional)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={uploadLat}
                          onChange={e => setUploadLat(e.target.value)}
                          placeholder="22.75"
                          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Longitude (optional)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={uploadLng}
                          onChange={e => setUploadLng(e.target.value)}
                          placeholder="-158.0"
                          className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">CSV file</label>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt"
                        required
                        className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-ocean-50 file:text-ocean-700 hover:file:bg-ocean-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full bg-ocean-700 text-white py-2 rounded-md text-sm font-medium hover:bg-ocean-800 disabled:opacity-50 transition-colors"
                    >
                      {uploading ? 'Uploading…' : 'Upload'}
                    </button>

                    {uploadResult && (
                      <div className="bg-green-50 border border-green-200 rounded-md px-4 py-2 text-sm text-green-700">
                        Imported <strong>{uploadResult.inserted}</strong> records
                        {uploadResult.skipped > 0 && `, skipped ${uploadResult.skipped}`}
                      </div>
                    )}
                    {uploadError && (
                      <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2 text-sm text-red-600">
                        {uploadError}
                      </div>
                    )}
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Data sources: SOEST/HOT Station ALOHA · Copernicus Marine Service (CMEMS) · IPACOA · Hawaii DAR/Reef Check
      </p>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Affiliation, CertLevel } from '../../types'

interface Props {
  onClose: () => void
}

type Tab = 'login' | 'register'

const AFFILIATION_OPTIONS: { value: Affiliation; label: string }[] = [
  { value: 'recreational', label: 'Recreational Diver' },
  { value: 'researcher', label: 'Marine Researcher / Scientist' },
  { value: 'educator', label: 'Educator / Student' },
  { value: 'professional', label: 'Dive Professional (Instructor, Guide)' },
  { value: 'community', label: 'Ocean Enthusiast' },
]

const CERT_OPTIONS: { value: CertLevel; label: string }[] = [
  { value: 'none', label: 'Not a certified diver' },
  { value: 'open_water', label: 'Open Water' },
  { value: 'advanced', label: 'Advanced Open Water' },
  { value: 'rescue', label: 'Rescue Diver' },
  { value: 'divemaster', label: 'Divemaster' },
  { value: 'instructor', label: 'Instructor' },
]

export function AuthModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [regForm, setRegForm] = useState({
    email: '',
    password: '',
    full_name: '',
    affiliation: '' as Affiliation | '',
    cert_level: '' as CertLevel | '',
  })

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(loginForm.email, loginForm.password)
      onClose()
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register({
        email: regForm.email,
        password: regForm.password,
        full_name: regForm.full_name || undefined,
        affiliation: regForm.affiliation || undefined,
        cert_level: regForm.cert_level || undefined,
      })
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t
                ? 'text-ocean-700 border-b-2 border-ocean-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  required type="email" autoComplete="email"
                  value={loginForm.email}
                  onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  required type="password" autoComplete="current-password"
                  value={loginForm.password}
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full bg-ocean-700 text-white py-2 rounded-md font-semibold text-sm hover:bg-ocean-900 disabled:opacity-50 transition-colors mt-1"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <p className="text-center text-xs text-gray-400">
                No account?{' '}
                <button type="button" onClick={() => setTab('register')} className="text-ocean-600 hover:underline">
                  Create one
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  required type="email" autoComplete="email"
                  value={regForm.email}
                  onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password * (min 8 chars)</label>
                <input
                  required type="password" minLength={8} autoComplete="new-password"
                  value={regForm.password}
                  onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text" placeholder="Optional"
                  value={regForm.full_name}
                  onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">I am a…</label>
                <select
                  value={regForm.affiliation}
                  onChange={e => setRegForm(p => ({ ...p, affiliation: e.target.value as Affiliation }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                >
                  <option value="">— select (optional) —</option>
                  {AFFILIATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dive Certification</label>
                <select
                  value={regForm.cert_level}
                  onChange={e => setRegForm(p => ({ ...p, cert_level: e.target.value as CertLevel }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500"
                >
                  <option value="">— select (optional) —</option>
                  {CERT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full bg-ocean-700 text-white py-2 rounded-md font-semibold text-sm hover:bg-ocean-900 disabled:opacity-50 transition-colors mt-1"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
              <p className="text-center text-xs text-gray-400">
                Already have an account?{' '}
                <button type="button" onClick={() => setTab('login')} className="text-ocean-600 hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

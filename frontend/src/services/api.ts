import axios from 'axios'
import type {
  ReefSite, SstHistory, SstYoY, DiverLog, DiverLogCreate, DiverLogPhoto,
  SpeciesSighting, SiteStat, ActiveAlerts, DiverStatOverTime,
  User, TokenResponse, RegisterPayload,
  PhTrendPoint, PhPrediction, PhSourceInfo,
  SiteSubscription, AlertHistoryEntry,
  TideData, WaveData, TurbidityData,
  SalinityData, ChlorophyllGrid, DhwForecast,
  ReefSiteAdmin, AuditLogEntry,
} from '../types'
import type { WeatherGridData } from '../hooks/useWeatherData'

export const TOKEN_KEY = 'coral_auth_token'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
  timeout: 60_000,
})

client.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const api = {
  // ── NOAA ────────────────────────────────────────────────────────────────────
  getCurrentConditions: (): Promise<ReefSite[]> =>
    client.get<ReefSite[]>('/noaa/current-conditions').then(r => r.data),

  getSstHistory: (siteId: string, days = 30): Promise<SstHistory> =>
    client.get<SstHistory>(`/noaa/sst/${siteId}`, { params: { days } }).then(r => r.data),

  getSstYoY: (siteId: string, days = 180): Promise<SstYoY> =>
    client.get<SstYoY>(`/noaa/sst/${siteId}/yoy`, { params: { days } }).then(r => r.data),

  getDhwForecast: (siteId: string, forecastDays = 28): Promise<DhwForecast> =>
    client.get<DhwForecast>(`/noaa/dhw-forecast/${siteId}`, { params: { forecast_days: forecastDays } }).then(r => r.data),

  getChlorophyllGrid: (): Promise<ChlorophyllGrid> =>
    client.get<ChlorophyllGrid>('/noaa/chlorophyll').then(r => r.data),

  getSalinity: (siteId: string): Promise<SalinityData> =>
    client.get<SalinityData>(`/noaa/salinity/${siteId}`).then(r => r.data),

  // ── Alerts ───────────────────────────────────────────────────────────────────
  getActiveAlerts: (): Promise<ActiveAlerts> =>
    client.get<ActiveAlerts>('/alerts/active').then(r => r.data),

  getSubscriptions: (): Promise<SiteSubscription[]> =>
    client.get<SiteSubscription[]>('/alerts/subscriptions').then(r => r.data),

  subscribe: (reefSiteId: string): Promise<SiteSubscription> =>
    client.post<SiteSubscription>('/alerts/subscriptions', { reef_site_id: reefSiteId }).then(r => r.data),

  unsubscribe: (reefSiteId: string): Promise<void> =>
    client.delete(`/alerts/subscriptions/${reefSiteId}`).then(() => undefined),

  // ── Diver Logs ───────────────────────────────────────────────────────────────
  getDiverLogs: (siteId?: string): Promise<DiverLog[]> =>
    client.get<DiverLog[]>('/diver-logs/', { params: siteId ? { site_id: siteId } : {} }).then(r => r.data),

  getRecentDiverLogs: (days = 90, limit = 100): Promise<DiverLog[]> =>
    client.get<DiverLog[]>('/diver-logs/', { params: { days, limit } }).then(r => r.data),

  submitDiverLog: (payload: DiverLogCreate): Promise<DiverLog> =>
    client.post<DiverLog>('/diver-logs/', payload).then(r => r.data),

  getDiverStatsBySite: (): Promise<SiteStat[]> =>
    client.get<SiteStat[]>('/diver-logs/stats/by-site').then(r => r.data),

  getDiverStatsOverTime: (days = 180): Promise<DiverStatOverTime[]> =>
    client.get<DiverStatOverTime[]>('/diver-logs/stats/over-time', { params: { days } }).then(r => r.data),

  exportDiverLogsCsv: (siteId?: string, startDate?: string, endDate?: string): string => {
    const params = new URLSearchParams()
    if (siteId) params.set('site_id', siteId)
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    const base = import.meta.env.VITE_API_BASE_URL
      ? `${import.meta.env.VITE_API_BASE_URL}/api`
      : '/api'
    return `${base}/diver-logs/export?${params.toString()}`
  },

  // ── Species Sightings ────────────────────────────────────────────────────────
  getSpeciesSightings: (logId: number): Promise<SpeciesSighting[]> =>
    client.get<SpeciesSighting[]>(`/diver-logs/${logId}/species`).then(r => r.data),

  // ── Photos ───────────────────────────────────────────────────────────────────
  getPhotos: (logId: number): Promise<DiverLogPhoto[]> =>
    client.get<DiverLogPhoto[]>(`/diver-logs/${logId}/photos`).then(r => r.data),

  uploadPhoto: (logId: number, file: File): Promise<DiverLogPhoto> => {
    const form = new FormData()
    form.append('file', file)
    return client.post<DiverLogPhoto>(`/diver-logs/${logId}/photos`, form).then(r => r.data)
  },

  deletePhoto: (logId: number, photoId: number): Promise<void> =>
    client.delete(`/diver-logs/${logId}/photos/${photoId}`).then(() => undefined),

  // ── Auth ─────────────────────────────────────────────────────────────────────
  login: (email: string, password: string): Promise<TokenResponse> =>
    client.post<TokenResponse>('/auth/login', { email, password }).then(r => r.data),

  register: (data: RegisterPayload): Promise<TokenResponse> =>
    client.post<TokenResponse>('/auth/register', data).then(r => r.data),

  getMe: (): Promise<User> =>
    client.get<User>('/auth/me').then(r => r.data),

  // ── pH ───────────────────────────────────────────────────────────────────────
  getPhTrend: (sources?: string[], years = 10): Promise<PhTrendPoint[]> => {
    const params = new URLSearchParams()
    if (sources) sources.forEach(s => params.append('sources', s))
    params.set('years', String(years))
    return client.get<PhTrendPoint[]>('/ph/trend', { params }).then(r => r.data)
  },

  getPhPrediction: (): Promise<PhPrediction> =>
    client.get<PhPrediction>('/ph/prediction').then(r => r.data),

  getPhSources: (): Promise<PhSourceInfo[]> =>
    client.get<PhSourceInfo[]>('/ph/sources').then(r => r.data),

  fetchCmems: (startDate: string, endDate?: string): Promise<{ inserted: number; skipped: number; start_date: string; end_date: string }> =>
    client.get('/ph/fetch/cmems', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),

  uploadPhCsv: (
    source: string,
    dataType: string,
    locationName: string,
    lat: number | null,
    lng: number | null,
    file: File,
  ): Promise<{ inserted: number; skipped: number }> => {
    const form = new FormData()
    form.append('source', source)
    form.append('data_type', dataType)
    form.append('location_name', locationName)
    if (lat !== null) form.append('lat', String(lat))
    if (lng !== null) form.append('lng', String(lng))
    form.append('file', file)
    return client.post('/ph/admin/upload', form).then(r => r.data)
  },

  // ── Conditions ───────────────────────────────────────────────────────────────
  getTides: (siteId: string): Promise<TideData> =>
    client.get<TideData>(`/tides/${siteId}`).then(r => r.data),

  getWaves: (siteId: string): Promise<WaveData> =>
    client.get<WaveData>(`/waves/${siteId}`).then(r => r.data),

  getTurbidity: (siteId: string): Promise<TurbidityData> =>
    client.get<TurbidityData>(`/turbidity/${siteId}`).then(r => r.data),

  getWeatherGrid: (): Promise<WeatherGridData> =>
    client.get<WeatherGridData>('/weather/grid').then(r => r.data),

  // ── Admin ─────────────────────────────────────────────────────────────────────
  getAdminSites: (): Promise<ReefSiteAdmin[]> =>
    client.get<ReefSiteAdmin[]>('/admin/sites').then(r => r.data),

  createAdminSite: (payload: Omit<ReefSiteAdmin, 'is_active' | 'created_at'>): Promise<ReefSiteAdmin> =>
    client.post<ReefSiteAdmin>('/admin/sites', payload).then(r => r.data),

  updateAdminSite: (siteId: string, payload: Partial<ReefSiteAdmin>): Promise<ReefSiteAdmin> =>
    client.patch<ReefSiteAdmin>(`/admin/sites/${siteId}`, payload).then(r => r.data),

  deleteAdminSite: (siteId: string): Promise<void> =>
    client.delete(`/admin/sites/${siteId}`).then(() => undefined),

  getAlertHistory: (siteId?: string, days = 90): Promise<AlertHistoryEntry[]> =>
    client.get<AlertHistoryEntry[]>('/admin/alert-history', { params: { site_id: siteId, days } }).then(r => r.data),

  getAuditLog: (action?: string, days = 30): Promise<AuditLogEntry[]> =>
    client.get<AuditLogEntry[]>('/admin/audit-log', { params: { action, days } }).then(r => r.data),
}

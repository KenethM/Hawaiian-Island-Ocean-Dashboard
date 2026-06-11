import axios from 'axios'
import type { ReefSite, SstHistory, DiverLog, DiverLogCreate, SiteStat, ActiveAlerts, DiverStatOverTime, User, TokenResponse, RegisterPayload, PhTrendPoint, PhPrediction, PhSourceInfo, SiteSubscription, TideData, WaveData, TurbidityData } from '../types'

const TOKEN_KEY = 'coral_auth_token'

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
})

client.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const api = {
  getCurrentConditions: (): Promise<ReefSite[]> =>
    client.get<ReefSite[]>('/noaa/current-conditions').then(r => r.data),

  getSstHistory: (siteId: string, days = 30): Promise<SstHistory> =>
    client.get<SstHistory>(`/noaa/sst/${siteId}`, { params: { days } }).then(r => r.data),

  getActiveAlerts: (): Promise<ActiveAlerts> =>
    client.get<ActiveAlerts>('/alerts/active').then(r => r.data),

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

  login: (email: string, password: string): Promise<TokenResponse> =>
    client.post<TokenResponse>('/auth/login', { email, password }).then(r => r.data),

  register: (data: RegisterPayload): Promise<TokenResponse> =>
    client.post<TokenResponse>('/auth/register', data).then(r => r.data),

  getMe: (): Promise<User> =>
    client.get<User>('/auth/me').then(r => r.data),

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

  getSubscriptions: (): Promise<SiteSubscription[]> =>
    client.get<SiteSubscription[]>('/alerts/subscriptions').then(r => r.data),

  subscribe: (reefSiteId: string): Promise<SiteSubscription> =>
    client.post<SiteSubscription>('/alerts/subscriptions', { reef_site_id: reefSiteId }).then(r => r.data),

  unsubscribe: (reefSiteId: string): Promise<void> =>
    client.delete(`/alerts/subscriptions/${reefSiteId}`).then(() => undefined),

  getTides: (siteId: string): Promise<TideData> =>
    client.get<TideData>(`/tides/${siteId}`).then(r => r.data),

  getWaves: (siteId: string): Promise<WaveData> =>
    client.get<WaveData>(`/waves/${siteId}`).then(r => r.data),

  getTurbidity: (siteId: string): Promise<TurbidityData> =>
    client.get<TurbidityData>(`/turbidity/${siteId}`).then(r => r.data),

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
}

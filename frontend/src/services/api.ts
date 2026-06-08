import axios from 'axios'
import type { ReefSite, SstHistory, DiverLog, DiverLogCreate, SiteStat, ActiveAlerts, DiverStatOverTime } from '../types'

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
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

  submitDiverLog: (payload: DiverLogCreate): Promise<DiverLog> =>
    client.post<DiverLog>('/diver-logs/', payload).then(r => r.data),

  getDiverStatsBySite: (): Promise<SiteStat[]> =>
    client.get<SiteStat[]>('/diver-logs/stats/by-site').then(r => r.data),

  getDiverStatsOverTime: (days = 180): Promise<DiverStatOverTime[]> =>
    client.get<DiverStatOverTime[]>('/diver-logs/stats/over-time', { params: { days } }).then(r => r.data),
}

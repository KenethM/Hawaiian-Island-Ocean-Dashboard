export type BleachingSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'mortality'

export interface AlertInfo {
  level: number   // -99=no data, -1=below MMM, 0=normal, 1=watch, 2=warning
  label: string
  color: string
}

export interface ReefSite {
  id: string
  name: string
  island: string
  lat: number
  lng: number
  depth_m: number
  mmm_c: number
  description: string
  sst_c: number | null
  alert: AlertInfo
}

export interface SstReading {
  time: string
  sst_c: number
}

export interface SstHistory {
  site_id: string
  site_name: string
  mmm_c: number
  readings: SstReading[]
}

export interface DiverLogCreate {
  reef_site_id: string
  diver_name?: string
  dive_date: string
  depth_m?: number
  coral_cover_pct?: number
  bleaching_pct?: number
  bleaching_severity?: BleachingSeverity
  water_temp_c?: number
  visibility_m?: number
  species_notes?: string
  general_notes?: string
}

export interface DiverLog extends DiverLogCreate {
  id: number
  submitted_at: string
}

export interface SiteStat {
  reef_site_id: string
  count: number
  avg_bleaching_pct: number | null
  avg_coral_cover_pct: number | null
  last_dive: string
}

export interface ActiveAlerts {
  count: number
  alerts: ReefSite[]
}

export interface DiverStatOverTime {
  date: string
  count: number
  avg_bleaching_pct: number | null
  avg_coral_cover_pct: number | null
}

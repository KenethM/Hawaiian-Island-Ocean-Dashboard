export type BleachingSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'mortality'
export type Affiliation = 'recreational' | 'researcher' | 'educator' | 'professional' | 'community'
export type CertLevel = 'none' | 'open_water' | 'advanced' | 'rescue' | 'divemaster' | 'instructor'

export interface User {
  id: number
  email: string
  full_name: string | null
  affiliation: Affiliation | null
  cert_level: CertLevel | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface RegisterPayload {
  email: string
  password: string
  full_name?: string
  affiliation?: Affiliation
  cert_level?: CertLevel
}

export interface AlertInfo {
  // -99=no data, -1=below MMM, 0=no stress, 1=watch, 2=warning, 3=alert lvl 1, 4=alert lvl 2
  level: number
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
  dhw: number | null       // Degree Heating Weeks (CRW) — accumulated thermal stress
  hotspot: number | null   // SST anomaly above bleaching threshold (CRW)
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

// ── Alert Subscriptions ───────────────────────────────────────────────────────

export interface SiteSubscription {
  id: number
  reef_site_id: string
  created_at: string
  last_notified_at: string | null
}

// ── Tides ─────────────────────────────────────────────────────────────────────

export interface TidePrediction {
  time: string      // "YYYY-MM-DD HH:MM"
  height_m: number
}

export interface TideHighLow extends TidePrediction {
  type: 'H' | 'L'
}

export interface TideData {
  site_id: string
  station_id: string | null
  station_name: string | null
  current: { time: string; height_m: number } | null
  tide_state: 'rising' | 'falling' | null
  predictions: TidePrediction[]
  high_lows: TideHighLow[]
}

// ── Waves ─────────────────────────────────────────────────────────────────────

export interface WaveObs {
  wave_height_m: number
  dominant_period_s: number | null
  mean_direction_deg: number | null
  mean_direction_label: string | null
  water_temp_c: number | null
  wind_speed_ms: number | null
  wind_dir_deg: number | null
  observed_at: string
  conditions_label: string
  conditions_color: string
}

export interface WaveData {
  site_id: string
  buoy_id: string | null
  buoy_name: string | null
  data: WaveObs | null
}

// ── Turbidity / Water Clarity ─────────────────────────────────────────────────

export interface ClarityDay {
  date: string
  days_ago: number
  kd490: number | null
  estimated_visibility_m: number | null
  label: string   // "Very Clear" | "Clear" | "Moderate" | "Slightly Turbid" | "Turbid" | "No data"
  color: string
}

export interface TurbidityData {
  site_id: string
  latest: ClarityDay | null    // most recent non-null reading
  history: ClarityDay[]        // last 7 days, newest first, includes no-data days
}

// ── Ocean pH ──────────────────────────────────────────────────────────────────

export type PhSource = 'hot' | 'cmems' | 'ipacoa' | 'dar_reef_check'

export interface PhTrendPoint {
  date: string      // "YYYY-MM"
  source: PhSource
  avg_ph: number
  count: number
}

export interface PhPredictionPoint {
  date: string
  ph: number
  lower: number | null
  upper: number | null
  is_forecast: boolean
}

export interface PhPrediction {
  trend: PhPredictionPoint[]
  forecast: PhPredictionPoint[]
  r_squared: number | null
}

export interface PhSourceInfo {
  source: PhSource
  data_type: string
  count: number
  earliest: string | null
  latest: string | null
}

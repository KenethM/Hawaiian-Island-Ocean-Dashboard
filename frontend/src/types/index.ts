export type BleachingSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'mortality'
export type Affiliation = 'recreational' | 'researcher' | 'educator' | 'professional' | 'community'
export type CertLevel = 'none' | 'open_water' | 'advanced' | 'rescue' | 'divemaster' | 'instructor'

export interface User {
  id: number
  email: string
  full_name: string | null
  affiliation: Affiliation | null
  cert_level: CertLevel | null
  is_admin: boolean
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
  dhw: number | null
  hotspot: number | null
  alert: AlertInfo
  fetched_at?: string
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
  fetched_at?: string
}

export interface SstYoY {
  site_id: string
  site_name: string
  mmm_c: number
  this_year: SstReading[]
  last_year: SstReading[]
  fetched_at: string
}

// ── Species Sightings ─────────────────────────────────────────────────────────

export interface SpeciesSightingCreate {
  species_name: string
  count?: number
  notes?: string
}

export interface SpeciesSighting extends SpeciesSightingCreate {
  id: number
}

// ── Diver Logs ────────────────────────────────────────────────────────────────

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
  species_sightings?: SpeciesSightingCreate[]
}

export interface DiverLog extends DiverLogCreate {
  id: number
  submitted_at: string
}

export interface DiverLogPhoto {
  id: number
  filename: string
  original_name: string
  url: string
  uploaded_at: string
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

// ── Alert History ─────────────────────────────────────────────────────────────

export interface AlertHistoryEntry {
  id: number
  reef_site_id: string
  alert_level: number
  alert_label: string
  sst_c: number | null
  dhw: number | null
  hotspot: number | null
  recorded_at: string
}

// ── Tides ─────────────────────────────────────────────────────────────────────

export interface TidePrediction {
  time: string
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
  label: string
  color: string
}

export interface TurbidityData {
  site_id: string
  latest: ClarityDay | null
  history: ClarityDay[]
}

// ── Salinity ──────────────────────────────────────────────────────────────────

export interface SalinityData {
  site_id: string
  station_id: string | null
  salinity_psu: number | null
  observed_at: string | null
  fetched_at: string
  note?: string
}

// ── Chlorophyll ───────────────────────────────────────────────────────────────

export interface ChlorophyllPoint {
  lat: number
  lng: number
  chlorophyll: number | null
}

export interface ChlorophyllGrid {
  date: string
  points: ChlorophyllPoint[]
  fetched_at: string
}

// ── DHW Forecast ──────────────────────────────────────────────────────────────

export interface DhwForecastPoint {
  day: number
  projected_sst_c: number
  accumulated_dhw: number
}

export interface DhwForecast {
  site_id: string
  site_name: string
  mmm_c: number
  current_dhw: number
  sst_trend_per_day: number
  last_observed_sst: number
  forecast: DhwForecastPoint[]
  historical_readings: SstReading[]
  fetched_at: string
}

// ── Ocean pH ──────────────────────────────────────────────────────────────────

export type PhSource = 'hot' | 'cmems' | 'ipacoa' | 'dar_reef_check'

export interface PhTrendPoint {
  date: string
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

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface ReefSiteAdmin {
  id: string
  name: string
  island: string
  lat: number
  lng: number
  depth_m: number
  mmm_c: number
  description: string | null
  is_active: boolean
  created_at: string
}

export interface AuditLogEntry {
  id: number
  user_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

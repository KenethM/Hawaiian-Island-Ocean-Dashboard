import { useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Marker, Popup } from 'react-leaflet'
import type { ReefSite } from '../../types'
import type { DiverLogWithCoords } from '../../hooks/useDiverLogs'
import { HealthLegend } from './HealthLegend'
import { WeatherOverlay, WeatherControlPanel } from './WeatherOverlay'
import type { WeatherControlState } from './WeatherOverlay'
import { useWeatherData } from '../../hooks/useWeatherData'
import { ChlorophyllOverlay, ChlorophyllLegend } from './ChlorophyllOverlay'

const SEVERITY_COLOR: Record<string, string> = {
  none: '#22c55e',
  mild: '#fbbf24',
  moderate: '#f97316',
  severe: '#ef4444',
  mortality: '#991b1b',
}

function severityColor(s: string | undefined): string {
  return s ? (SEVERITY_COLOR[s] ?? '#94a3b8') : '#94a3b8'
}

function diverPinIcon(severity: string | undefined): L.DivIcon {
  const color = severityColor(severity)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="0 0 18 24">
    <path d="M9 0C4.03 0 0 4.03 0 9c0 6.75 9 15 9 15s9-8.25 9-15C18 4.03 13.97 0 9 0z"
      fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="9" cy="9" r="3.5" fill="#fff" fill-opacity="0.85"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [18, 24],
    iconAnchor: [9, 24],
    popupAnchor: [0, -26],
  })
}

const DEFAULT_WEATHER_STATE: WeatherControlState = {
  enabled: false,
  showForecast: false,
  forecastDay: 0,
  mode: 'today',
  opacity: 0.8,
  animating: false,
  animDay: 0,
}

interface Props {
  sites: ReefSite[]
  selectedSiteId: string | null
  onSelectSite: (id: string) => void
  diverLogs?: DiverLogWithCoords[]
}

export function ReefMap({ sites, selectedSiteId, onSelectSite, diverLogs = [] }: Props) {
  const [weather, setWeather] = useState<WeatherControlState>(DEFAULT_WEATHER_STATE)
  const { data: weatherData, loading: weatherLoading, error: weatherError } = useWeatherData(weather.enabled)
  const [showChlorophyll, setShowChlorophyll] = useState(false)

  const histDays = weatherData
    ? weatherData.grid[0]?.daily.filter(d => !d.is_forecast).length ?? 30
    : 30

  function handleWeatherChange(patch: Partial<WeatherControlState>) {
    setWeather(prev => ({ ...prev, ...patch }))
  }

  function handleTickDay(next: number) {
    setWeather(prev => ({ ...prev, animDay: next }))
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[21.0, -157.5]}
        zoom={7}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Weather heatmap */}
        <WeatherOverlay data={weatherData ?? null} state={weather} />

        {/* Chlorophyll overlay */}
        {showChlorophyll && <ChlorophyllOverlay />}

        {/* Reef site health circles */}
        {sites.map(site => (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lng]}
            radius={selectedSiteId === site.id ? 14 : 10}
            pathOptions={{
              fillColor: site.alert.color,
              color: selectedSiteId === site.id ? '#1e293b' : '#fff',
              weight: selectedSiteId === site.id ? 3 : 1.5,
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => onSelectSite(site.id) }}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -8]}>
              <div className="text-xs font-medium">
                <p className="font-semibold">{site.name}</p>
                <p>{site.island}</p>
                {site.sst_c !== null
                  ? <p>SST: {site.sst_c.toFixed(1)}°C · {site.alert.label}</p>
                  : <p>No SST data</p>}
                {site.dhw !== null && <p>DHW: {site.dhw.toFixed(1)} °C-weeks</p>}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Diver log pins */}
        {diverLogs.map(log => (
          <Marker
            key={log.id}
            position={[log.lat, log.lng]}
            icon={diverPinIcon(log.bleaching_severity ?? undefined)}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[160px]">
                <p className="font-semibold text-sm">{log.siteName}</p>
                <p className="text-gray-500">{log.dive_date} · {log.diver_name ?? 'Anonymous'}</p>
                {log.bleaching_severity && (
                  <p>
                    <span className="font-medium">Bleaching:</span>{' '}
                    <span style={{ color: severityColor(log.bleaching_severity) }} className="font-semibold capitalize">
                      {log.bleaching_severity}
                    </span>
                    {log.bleaching_pct != null && ` (${log.bleaching_pct}%)`}
                  </p>
                )}
                {log.coral_cover_pct != null && (
                  <p><span className="font-medium">Coral cover:</span> {log.coral_cover_pct}%</p>
                )}
                {log.depth_m != null && (
                  <p><span className="font-medium">Depth:</span> {log.depth_m} m</p>
                )}
                {log.water_temp_c != null && (
                  <p><span className="font-medium">Water temp:</span> {log.water_temp_c.toFixed(1)}°C</p>
                )}
                {log.general_notes && (
                  <p className="text-gray-600 italic mt-1">{log.general_notes}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Chl-a toggle + bleaching risk legend, stacked bottom-left */}
      <div className="absolute bottom-8 left-3 z-[1000] flex flex-col items-start gap-2">
        <button
          onClick={() => setShowChlorophyll(v => !v)}
          className={`text-xs px-2.5 py-1.5 rounded-md font-medium shadow border transition-colors ${
            showChlorophyll
              ? 'bg-green-700 text-white border-green-800'
              : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
          }`}
        >
          {showChlorophyll ? '🌿 Chl-a on' : '🌿 Chl-a'}
        </button>
        <ChlorophyllLegend visible={showChlorophyll} />
        <HealthLegend />
      </div>

      {/* Weather control panel — floats over the map */}
      <WeatherControlPanel
        state={weather}
        histDays={histDays}
        loading={weatherLoading}
        error={weatherError}
        onChange={handleWeatherChange}
        onTickDay={handleTickDay}
      />

    </div>
  )
}

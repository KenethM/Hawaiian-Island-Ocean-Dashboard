import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import type { ReefSite } from '../../types'
import { HealthLegend } from './HealthLegend'

interface Props {
  sites: ReefSite[]
  selectedSiteId: string | null
  onSelectSite: (id: string) => void
}

export function ReefMap({ sites, selectedSiteId, onSelectSite }: Props) {
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
      </MapContainer>

      <HealthLegend />
    </div>
  )
}

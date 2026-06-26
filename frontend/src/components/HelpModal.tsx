interface Props {
  onClose: () => void
}

const NODE_COLORS = [
  ['#22c55e', 'No Stress', 'Sea temp at or below normal — no heat stress detected'],
  ['#f97316', 'Watch', 'SST 1 °C above bleaching threshold — monitor closely'],
  ['#ef4444', 'Warning', 'SST 2 °C above threshold — bleaching possible'],
  ['#dc2626', 'Alert Level 1', 'Significant bleaching likely'],
  ['#7f1d1d', 'Alert Level 2', 'Severe, potentially fatal bleaching expected'],
  ['#3b82f6', 'Below MMM (cool)', 'Cooler than historical average — no stress'],
  ['#60a5fa', 'SST Unavailable', 'Site active (wave/tide data present) but no SST reading'],
]

const DATA_SOURCES = [
  ['NOAA Coral Reef Watch', 'Satellite bleaching alert area (BAA), degree heating weeks (DHW), and hotspot. 5 km resolution, updated daily.'],
  ['Open-Meteo Marine API', 'Sea surface temperature from ERA5/ICON ocean models — works globally, no cloud-IP restrictions.'],
  ['NOAA NDBC Buoys', 'Real-time wave height, period, swell direction, and surface wind from the nearest observation buoy.'],
  ['NOAA CO-OPS Tides', 'Hourly tide predictions and gauge readings for nearby tide stations.'],
  ['NASA GIBS (Chl-a)', 'VIIRS SNPP satellite chlorophyll-a imagery processed by NASA Ocean Biology. ~2-day delay, loaded directly in browser.'],
  ['Open-Meteo Weather', 'Rainfall and weather-code forecasts across 25 grid points covering all major islands.'],
]

const ORGS = [
  ['Purple Maia Foundation', 'Community ocean stewardship rooted in native Hawaiian cultural connection to the sea.'],
  ['NOAA Coral Reef Watch', 'Near real-time satellite monitoring of coral bleaching stress worldwide.'],
  ['NASA Ocean Biology', 'VIIRS satellite chlorophyll and ocean color science products.'],
  ['Hawaii Ocean Time-series (HOT)', 'Monthly deep-ocean measurements at Station ALOHA north of Oahu since 1988.'],
]

export function HelpModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Sticky header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-6 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Hawaii Reef Dashboard — Guide</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Features, data sources, and how to navigate</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-2xl leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-7">

          {/* Node color legend */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Map Nodes — Bleaching Risk Colors</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Based on NOAA Coral Reef Watch satellite data. Click any node to open the site panel.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NODE_COLORS.map(([color, label, desc]) => (
                <div key={label} className="flex items-start gap-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                    style={{ background: color }}
                  />
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{label}</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Site panel tabs */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Site Panel Tabs</h3>
            <div className="space-y-2 text-xs text-gray-600 dark:text-slate-300">
              <div className="border-l-2 border-ocean-500 pl-3">
                <p className="font-semibold text-gray-800 dark:text-slate-200">Overview</p>
                <p>Live wave conditions, water height, salinity, tides, and water clarity (MODIS satellite Kd490).</p>
              </div>
              <div className="border-l-2 border-ocean-500 pl-3">
                <p className="font-semibold text-gray-800 dark:text-slate-200">Temperature</p>
                <p>60-day SST history vs bleaching thresholds, year-over-year comparison, and 28-day DHW forecast.</p>
              </div>
              <div className="border-l-2 border-ocean-500 pl-3">
                <p className="font-semibold text-gray-800 dark:text-slate-200">Log Dive</p>
                <p>Submit your coral health observation — bleaching severity, coral cover %, depth, and notes (account required).</p>
              </div>
              <div className="border-l-2 border-ocean-500 pl-3">
                <p className="font-semibold text-gray-800 dark:text-slate-200">Reports</p>
                <p>Community diver reports for that specific site.</p>
              </div>
            </div>
          </section>

          {/* Map overlays */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Map Overlays</h3>
            <div className="space-y-2">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 mb-1">Chlorophyll-a (Chl-a button, bottom-left)</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Shows VIIRS satellite chlorophyll concentration — an indicator of phytoplankton and ocean productivity. Purple/dark = low, yellow/green = high. From NASA GIBS, ~2 days delayed.</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 mb-1">Weather Heatmap (top-right panel)</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Rainfall heatmap across 25 grid points. Switch between historical days and 7-day forecast. Animate to watch rainfall move across the islands.</p>
              </div>
            </div>
          </section>

          {/* Other features */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Other Features</h3>
            <ul className="space-y-1.5 text-xs text-gray-600 dark:text-slate-400">
              <li><span className="font-semibold text-gray-800 dark:text-slate-200">Bell icon</span> — Subscribe for email alerts when bleaching is detected at a site.</li>
              <li><span className="font-semibold text-gray-800 dark:text-slate-200">Compare ⇄</span> — Side-by-side comparison of any two reef sites (appears in the nav bar when sites are loaded).</li>
              <li><span className="font-semibold text-gray-800 dark:text-slate-200">Community Data</span> — Charts and timeline of all submitted diver observations across all sites.</li>
              <li><span className="font-semibold text-gray-800 dark:text-slate-200">Ocean pH</span> — Water chemistry data from Hawaii Ocean Time-series and CMEMS satellite carbonate system models.</li>
              <li><span className="font-semibold text-gray-800 dark:text-slate-200">Sidebar toggle</span> — Collapse the right panel with the ❯ button at the edge of the map for a full-screen map view.</li>
            </ul>
          </section>

          {/* Data sources */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Data Sources</h3>
            <div className="space-y-2">
              {DATA_SOURCES.map(([name, desc]) => (
                <div key={name} className="border-l-2 border-gray-200 dark:border-slate-600 pl-3">
                  <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Orgs */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Affiliated Organizations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ORGS.map(([org, desc]) => (
                <div key={org} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{org}</p>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="bg-ocean-700 hover:bg-ocean-900 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  )
}

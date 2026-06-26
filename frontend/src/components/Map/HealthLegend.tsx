const LEGEND = [
  { color: '#22c55e', label: 'No Stress' },
  { color: '#f97316', label: 'Watch' },
  { color: '#ef4444', label: 'Warning' },
  { color: '#dc2626', label: 'Alert Level 1' },
  { color: '#7f1d1d', label: 'Alert Level 2' },
  { color: '#3b82f6', label: 'Below MMM (cool)' },
  { color: '#60a5fa', label: 'SST Unavailable' },
]

export function HealthLegend() {
  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">Bleaching Risk</p>
      <p className="text-gray-400 mb-2" style={{ fontSize: '10px' }}>Source: NOAA Coral Reef Watch</p>
      {LEGEND.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

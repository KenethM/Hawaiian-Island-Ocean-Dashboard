const LEGEND = [
  { color: '#22c55e', label: 'Normal (below MMM+1°C)' },
  { color: '#f97316', label: 'Watch (MMM+1°C)' },
  { color: '#ef4444', label: 'Warning (MMM+2°C)' },
  { color: '#3b82f6', label: 'Below MMM (cool)' },
  { color: '#6b7280', label: 'No data' },
]

export function HealthLegend() {
  return (
    <div className="absolute bottom-8 left-4 z-[400] bg-white/90 backdrop-blur rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">Bleaching Risk</p>
      {LEGEND.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

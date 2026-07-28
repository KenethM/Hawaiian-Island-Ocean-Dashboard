export function SegmentedControl<T extends string>({
  options, value, onChange, tone = 'light', size = 'md',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  /** 'light' = card-tinted track for use on light sheets; 'dark' = translucent track for use over the map */
  tone?: 'light' | 'dark'
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={`flex gap-1 p-1 rounded-full ${size === 'sm' ? 'text-[12.5px]' : 'text-[13px]'}`}
      style={{ background: tone === 'dark' ? 'rgba(15,41,52,0.5)' : 'var(--k-track2)', backdropFilter: tone === 'dark' ? 'blur(10px)' : undefined }}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 text-center py-2 rounded-full font-semibold transition-colors"
            style={
              active
                ? { background: 'var(--k-card)', color: '#0f766e', boxShadow: '0 1px 4px rgba(8,40,52,0.12)' }
                : { color: tone === 'dark' ? '#fff' : 'var(--k-sub)', opacity: tone === 'dark' ? 0.85 : 1 }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

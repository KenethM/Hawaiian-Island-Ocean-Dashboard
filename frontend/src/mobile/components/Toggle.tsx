export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-[42px] h-6 rounded-full relative flex-shrink-0 transition-colors duration-200"
      style={{ background: checked ? '#15803D' : 'var(--k-line)' }}
      role="switch"
      aria-checked={checked}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-[var(--k-card)] transition-all duration-200"
        style={{ left: checked ? '20px' : '2px' }}
      />
    </button>
  )
}

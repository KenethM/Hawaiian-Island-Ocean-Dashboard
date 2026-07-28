export function SectionDivider({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 my-3 ${className}`}>
      <div className="h-px flex-1 bg-[var(--k-hair)]" />
      <span className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#15803D]" style={{ opacity: 0.85 }}>
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--k-hair)]" />
    </div>
  )
}

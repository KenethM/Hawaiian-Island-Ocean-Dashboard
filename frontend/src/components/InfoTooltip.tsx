interface Props {
  text: string
  width?: string
}

export function InfoTooltip({ text, width = 'w-52' }: Props) {
  return (
    <span className="group relative inline-flex items-center ml-1 normal-case tracking-normal font-normal">
      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-[9px] font-bold flex items-center justify-center cursor-help select-none transition-colors">
        i
      </span>
      <span
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${width} p-2 bg-gray-800 text-white text-[10px] rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[9999] leading-snug`}
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </span>
    </span>
  )
}

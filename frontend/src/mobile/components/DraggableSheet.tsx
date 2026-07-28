import { useRef, useState, type ReactNode } from 'react'

interface DraggableSheetProps {
  children: ReactNode
  /** Distance from the bottom of the viewport (e.g. to clear the tab bar). */
  bottomOffset: number | string
  /** Height when collapsed to a peek, in px — leaves most of the map visible. */
  peekHeight?: number
  /** Default resting height, in px. */
  defaultHeight?: number
  /** Fraction of the viewport height available when fully expanded. */
  expandedFraction?: number
}

export function DraggableSheet({
  children, bottomOffset, peekHeight = 108, defaultHeight = 392, expandedFraction = 0.72,
}: DraggableSheetProps) {
  const [height, setHeight] = useState(defaultHeight)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  function expandedMax() {
    return Math.round(window.innerHeight * expandedFraction)
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startHeight: height, moved: false }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dy = e.clientY - drag.startY
    if (Math.abs(dy) > 4) drag.moved = true
    const next = Math.min(expandedMax(), Math.max(peekHeight, drag.startHeight - dy))
    setHeight(next)
  }

  function onPointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragging(false)
    const stops = [peekHeight, defaultHeight, expandedMax()]
    if (!drag.moved) {
      // Treat a plain tap on the handle as "toggle to the next larger stop, wrapping around".
      const idx = stops.findIndex(s => s === height)
      setHeight(stops[(idx + 1 + stops.length) % stops.length] ?? defaultHeight)
      return
    }
    const nearest = stops.reduce((a, b) => (Math.abs(b - height) < Math.abs(a - height) ? b : a))
    setHeight(nearest)
  }

  return (
    <div
      className="absolute left-0 right-0 z-[3] overflow-y-auto px-5 pt-1 pb-6"
      style={{
        bottom: bottomOffset,
        height,
        background: 'var(--k-sheet)',
        backdropFilter: 'blur(20px)',
        borderRadius: '26px 26px 0 0',
        boxShadow: '0 -18px 40px -20px rgba(8,40,52,0.35)',
        transition: dragging ? 'none' : 'height 0.25s ease',
      }}
    >
      <div
        className="sticky top-0 pt-2 pb-3.5 -mx-5 px-5 cursor-grab touch-none"
        style={{ background: 'var(--k-sheet)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="w-[38px] h-1 rounded-full mx-auto" style={{ background: 'var(--k-line)' }} />
      </div>
      {children}
    </div>
  )
}

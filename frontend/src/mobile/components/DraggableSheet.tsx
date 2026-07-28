import { useRef, useState, type ReactNode } from 'react'

interface DraggableSheetProps {
  children: ReactNode
  /** Distance from the bottom of the viewport (e.g. to clear the tab bar). */
  bottomOffset: number | string
  /** Height when collapsed to a peek — just the handle, map is fully visible. */
  peekHeight: number
  /** Default resting height, in px. */
  defaultHeight: number
  /** Fraction of the viewport height available when fully expanded. */
  expandedFraction: number
  /** Reports live height during drag and on every snap, so the parent can drive other animations off it. */
  onHeightChange?: (height: number) => void
}

const SNAP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const FLICK_VELOCITY = 0.55 // px/ms — above this, snap in the flick direction instead of to the nearest stop

export function DraggableSheet({
  children, bottomOffset, peekHeight, defaultHeight, expandedFraction, onHeightChange,
}: DraggableSheetProps) {
  const [height, setHeightState] = useState(defaultHeight)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean; lastY: number; lastT: number; vy: number } | null>(null)

  function setHeight(h: number) {
    setHeightState(h)
    onHeightChange?.(h)
  }

  function expandedMax() {
    return Math.round(window.innerHeight * expandedFraction)
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
    const now = performance.now()
    dragRef.current = { startY: e.clientY, startHeight: height, moved: false, lastY: e.clientY, lastT: now, vy: 0 }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dy = e.clientY - drag.startY
    if (Math.abs(dy) > 4) drag.moved = true
    const now = performance.now()
    const dt = now - drag.lastT
    if (dt > 0) drag.vy = (e.clientY - drag.lastY) / dt
    drag.lastY = e.clientY
    drag.lastT = now
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
      // Plain tap on the handle cycles to the next larger stop, wrapping around. Found by
      // nearest match rather than exact equality — expandedMax() depends on window.innerHeight,
      // which can drift (orientation change, mobile toolbar show/hide) between the last snap
      // and this tap, so `height` may no longer exactly equal any entry in `stops`.
      const idx = stops.reduce((closest, s, i) => (Math.abs(s - height) < Math.abs(stops[closest] - height) ? i : closest), 0)
      setHeight(stops[(idx + 1) % stops.length])
      return
    }
    if (Math.abs(drag.vy) > FLICK_VELOCITY) {
      // A decisive flick snaps straight to the extreme in that direction, skipping the middle stop.
      setHeight(drag.vy > 0 ? peekHeight : expandedMax())
      return
    }
    const nearest = stops.reduce((a, b) => (Math.abs(b - height) < Math.abs(a - height) ? b : a))
    setHeight(nearest)
  }

  const contentOpacity = Math.min(1, Math.max(0, (height - peekHeight) / 56))

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
        transition: dragging ? 'none' : `height 0.22s ${SNAP_EASE}`,
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
      <div style={{ opacity: contentOpacity, pointerEvents: contentOpacity < 0.05 ? 'none' : undefined, transition: dragging ? 'none' : 'opacity 0.18s ease' }}>
        {children}
      </div>
    </div>
  )
}

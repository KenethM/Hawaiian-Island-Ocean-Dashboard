import { useEffect, useState } from 'react'

/**
 * Must match SHARE_URL in scripts/make_qr_code.py — the QR image is a build artifact from
 * that script, and this string is only the human-readable copy shown beside it. If they
 * drift, the code and the text send people to different places.
 */
const CANONICAL_URL = 'https://kenethm.github.io/Hawaiian-Island-Ocean-Dashboard/'

// Lives in public/, so it needs the Vite base prefix to resolve under the /repo-name/ path
// GitHub Pages serves the app from.
const QR_SRC = `${import.meta.env.BASE_URL}qr-dashboard.svg`

export function ShareQrModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(CANONICAL_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard is blocked outside a secure context — the URL is on screen to read.
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: 'Hawaii Coral Reef Dashboard',
        text: 'Live reef conditions for Hawaiian dive sites',
        url: CANONICAL_URL,
      })
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(8,25,33,0.62)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share this app"
    >
      <div
        className="w-full max-w-[340px] rounded-3xl p-5"
        style={{ background: 'var(--k-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="serif text-[20px]" style={{ color: 'var(--k-ink)' }}>Share this app</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--k-sub)' }}>
              Point a camera at the code to open the dashboard.
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex-shrink-0 -mt-1 -mr-1 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--k-sub)" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Always on white, never the themed card colour — a QR needs a light quiet zone to
            scan, so dark mode must not invert it. */}
        <div className="rounded-2xl mt-3.5 p-3" style={{ background: '#ffffff' }}>
          <img
            src={QR_SRC}
            alt={`QR code linking to ${CANONICAL_URL}`}
            width={280}
            height={280}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        <div
          className="text-[11.5px] mt-3 px-3 py-2 rounded-xl break-all text-center"
          style={{ background: 'var(--k-track2)', color: 'var(--k-sub)' }}
        >
          {CANONICAL_URL.replace(/^https:\/\//, '')}
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={copyLink}
            className="flex-1 rounded-full py-2.5 text-[13px] font-semibold border"
            style={{ borderColor: 'var(--k-border)', color: 'var(--k-ink2)', background: 'var(--k-bg)' }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {canShare && (
            <button
              onClick={share}
              className="flex-1 rounded-full py-2.5 text-[13px] font-semibold text-white"
              style={{ background: '#15803D' }}
            >
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

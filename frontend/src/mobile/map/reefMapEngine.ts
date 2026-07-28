// Ported near-verbatim from the design handoff's reef-map-engine.js (the real,
// complete `createReefMap` source — canvas drawing, animation loop, wildlife/weather/
// current code). Only change: site status/sst/color are injected from live app data
// instead of hardcoded, via `update()`. Geometry (ISLANDS, SITES x/y) is untouched.

export type MapLayer = 'all' | 'reef' | 'weather' | 'currents' | 'life'

export interface MapSite {
  id: string
  name: string
  x: number
  y: number
  color: string
  label: string
  sst: number | null
}

interface EngineOptions {
  layer?: MapLayer
  dark?: boolean
  onSelect?: (site: MapSite | null) => void
  zoom?: number
  anchorY?: number
  centerX?: number
  centerY?: number
}

const STATUS = {
  green: { c: '#16A34A', label: 'No stress' },
  watch: { c: '#F59E0B', label: 'Watch' },
  warning: { c: '#DC2626', label: 'Warning' },
}

// Islands in a 1000 x 560 design space (SE big island on the right → NW on the left)
const ISLANDS = [
  { cx: 226, cy: 205, rx: 18, ry: 26, seed: 1.2 }, // Niihau
  { cx: 300, cy: 178, rx: 46, ry: 42, seed: 2.7 }, // Kauai
  { cx: 470, cy: 275, rx: 50, ry: 40, seed: 0.9 }, // Oahu
  { cx: 600, cy: 300, rx: 52, ry: 20, seed: 3.4 }, // Molokai
  { cx: 648, cy: 356, rx: 23, ry: 19, seed: 1.9 }, // Lanai
  { cx: 692, cy: 401, rx: 22, ry: 13, seed: 2.2 }, // Kahoolawe
  { cx: 732, cy: 346, rx: 46, ry: 38, seed: 0.4 }, // Maui
  { cx: 884, cy: 456, rx: 76, ry: 68, seed: 1.5 }, // Big Island
]

// id here is the short "design" id; ReefMap.tsx maps it to/from the app's real site id.
const BASE_SITES: MapSite[] = [
  { id: 'tunnels', name: 'Tunnels Reef', x: 288, y: 146, color: STATUS.green.c, label: STATUS.green.label, sst: 27.2 },
  { id: 'poipu', name: 'Poipu Beach', x: 316, y: 212, color: STATUS.green.c, label: STATUS.green.label, sst: 27.3 },
  { id: 'sharks', name: "Shark's Cove", x: 446, y: 238, color: STATUS.green.c, label: STATUS.green.label, sst: 27.4 },
  { id: 'kaneohe', name: 'Kaneohe Bay', x: 508, y: 262, color: STATUS.watch.c, label: STATUS.watch.label, sst: 28.0 },
  { id: 'hanauma', name: 'Hanauma Bay', x: 496, y: 308, color: STATUS.green.c, label: STATUS.green.label, sst: 27.6 },
  { id: 'honolua', name: 'Honolua Bay', x: 700, y: 316, color: STATUS.watch.c, label: STATUS.watch.label, sst: 28.3 },
  { id: 'molokini', name: 'Molokini', x: 726, y: 398, color: STATUS.green.c, label: STATUS.green.label, sst: 27.5 },
  { id: 'kealakekua', name: 'Kealakekua Bay', x: 838, y: 486, color: STATUS.green.c, label: STATUS.green.label, sst: 27.5 },
  { id: 'kona', name: 'Kona Coast', x: 820, y: 440, color: STATUS.warning.c, label: STATUS.warning.label, sst: 29.1 },
]

// layer emphasis multipliers
const LAYERS: Record<MapLayer, { cloud: number; rain: number; cur: number; life: number; dot: number; labels: boolean }> = {
  all: { cloud: 0.55, rain: 0.35, cur: 0.55, life: 1.0, dot: 1.0, labels: false },
  reef: { cloud: 0.22, rain: 0.10, cur: 0.32, life: 0.55, dot: 1.2, labels: false },
  weather: { cloud: 1.0, rain: 1.0, cur: 0.28, life: 0.30, dot: 0.55, labels: false },
  currents: { cloud: 0.25, rain: 0.10, cur: 1.0, life: 0.40, dot: 0.6, labels: false },
  life: { cloud: 0.28, rain: 0.10, cur: 0.42, life: 1.25, dot: 0.65, labels: true },
}

function rand(a: number, b: number) { return a + Math.random() * (b - a) }

// organic closed island path via jittered radial points
function islandPath(ctx: CanvasRenderingContext2D, isl: typeof ISLANDS[number], inset?: number) {
  const n = 26, k = inset || 1
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const wob = 1 + 0.12 * Math.sin(isl.seed + 3 * a) + 0.07 * Math.cos(isl.seed * 1.7 + 5 * a)
    const x = isl.cx + Math.cos(a) * isl.rx * wob * k
    const y = isl.cy + Math.sin(a) * isl.ry * wob * k
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function insideLand(x: number, y: number, pad?: number) {
  pad = pad || 1
  for (const d of ISLANDS) {
    const dx = (x - d.cx) / (d.rx * pad), dy = (y - d.cy) / (d.ry * pad)
    if (dx * dx + dy * dy < 1) return true
  }
  return false
}

export function createReefMap(canvas: HTMLCanvasElement, opts: EngineOptions = {}) {
  const ctx = canvas.getContext('2d')!
  let layer: MapLayer = opts.layer || 'all'
  const onSelect = opts.onSelect || (() => {})
  let selected: string | null = null
  const zoom = opts.zoom || 1
  const anchorY = opts.anchorY != null ? opts.anchorY : 0.5
  const cX = opts.centerX != null ? opts.centerX : 500
  const cY = opts.centerY != null ? opts.centerY : 280
  let themeDark = !!opts.dark

  const SITES: MapSite[] = BASE_SITES.map(s => ({ ...s }))

  let dpr = 1, W = 0, H = 0, scale = 1, ox = 0, oy = 0
  const bounds = { x0: 0, y0: 0, x1: 1000, y1: 560 }
  type Particle = { x: number; y: number; px: number; py: number; life: number; spd: number }
  let particles: Particle[] = []
  type Cloud = { x: number; y: number; vx: number; vy: number; s: number; rain: boolean; seed: number; puffs: { dx: number; dy: number; r: number }[] }
  let clouds: Cloud[] = []
  const t0 = performance.now()
  let raf = 0
  let alive = true

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    W = canvas.clientWidth; H = canvas.clientHeight
    if (!W || !H) return
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const base = Math.min(W / 1000, H / 560)
    scale = base * zoom
    ox = W / 2 - cX * scale
    oy = anchorY * H - cY * scale
    bounds.x0 = -ox / scale; bounds.y0 = -oy / scale
    bounds.x1 = (W - ox) / scale; bounds.y1 = (H - oy) / scale
    seedParticles(); seedClouds()
  }

  function flow(x: number, y: number, t: number) {
    let vx = -0.85, vy = -0.22
    vy += 0.38 * Math.sin(x / 150 + t * 0.18)
    vx += 0.16 * Math.cos(y / 120 - t * 0.14)
    for (const d of ISLANDS) {
      const dx = x - d.cx, dy = y - d.cy
      const nd = Math.sqrt((dx / (d.rx * 1.7)) * (dx / (d.rx * 1.7)) + (dy / (d.ry * 1.7)) * (dy / (d.ry * 1.7)))
      if (nd < 1) { const f = (1 - nd) * 2.2; vx += (dx / (Math.abs(dx) + Math.abs(dy) + 1)) * f; vy += (dy / (Math.abs(dx) + Math.abs(dy) + 1)) * f }
    }
    const m = Math.sqrt(vx * vx + vy * vy) || 1
    return { x: vx / m, y: vy / m }
  }

  function spawnP(): Particle {
    let x = 0, y = 0, tries = 0
    do { x = rand(bounds.x0, bounds.x1); y = rand(bounds.y0, bounds.y1); tries++ }
    while (insideLand(x, y, 1.05) && tries < 8)
    return { x, y, px: x, py: y, life: rand(60, 200), spd: rand(14, 26) }
  }
  function seedParticles() {
    const area = (bounds.x1 - bounds.x0) * (bounds.y1 - bounds.y0)
    const n = Math.max(70, Math.min(190, Math.round(area / 4200)))
    particles = []; for (let i = 0; i < n; i++) particles.push(spawnP())
  }

  function makeCloud(): Cloud {
    const puffs = [], np = 4 + ((Math.random() * 4) | 0), sc = rand(0.8, 1.5)
    for (let i = 0; i < np; i++) puffs.push({ dx: rand(-55, 55), dy: rand(-22, 22), r: rand(26, 52) })
    return {
      x: rand(bounds.x0, bounds.x1 + 300), y: rand(bounds.y0 - 20, bounds.y0 + (bounds.y1 - bounds.y0) * 0.7),
      vx: rand(-16, -10), vy: rand(3, 7), s: sc, rain: Math.random() < 0.5, seed: rand(0, 10), puffs,
    }
  }
  function seedClouds() { clouds = []; const n = 3 + ((Math.random() * 2) | 0); for (let i = 0; i < n; i++) clouds.push(makeCloud()) }

  // life markers (deterministic paths)
  function drawFish(x: number, y: number, ang: number, s: number, alpha: number) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.ellipse(0, 0, 16 * s, 6.5 * s, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(-24 * s, -7 * s); ctx.lineTo(-22 * s, 0); ctx.lineTo(-24 * s, 7 * s); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#0f766e'; ctx.beginPath(); ctx.moveTo(2 * s, -4 * s); ctx.lineTo(-4 * s, -12 * s); ctx.lineTo(-8 * s, -4 * s); ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  function drawCanoe(x: number, y: number, ang: number, alpha: number) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(-26, 10, -40, 5); ctx.stroke()
    ctx.fillStyle = '#3f2d1e'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(0, 9, 20, 0); ctx.quadraticCurveTo(0, 4, -18, 0); ctx.fill()
    ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(2, 12); ctx.moveTo(6, 2); ctx.lineTo(10, 12); ctx.stroke()
    ctx.fillStyle = '#3f2d1e'; ctx.beginPath(); ctx.ellipse(6, 13, 12, 2.4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(250,250,249,0.95)'; ctx.beginPath(); ctx.moveTo(0, -1); ctx.quadraticCurveTo(20, -14, 4, -30); ctx.quadraticCurveTo(-2, -16, 0, -1); ctx.fill()
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -30); ctx.stroke()
    ctx.restore()
  }
  function drawBird(x: number, y: number, s: number, alpha: number) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'
    const flap = Math.sin(performance.now() / 180 + x) * 3
    ctx.beginPath(); ctx.moveTo(x - 6 * s, y + flap); ctx.lineTo(x, y - 2); ctx.lineTo(x + 6 * s, y + flap); ctx.stroke()
    ctx.restore()
  }
  function drawWhale(x: number, y: number, dir: number, alpha: number, spout: number) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.scale(dir, 1)
    ctx.fillStyle = '#334155'
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-8, -13, 20, -5); ctx.quadraticCurveTo(32, -1, 36, 0); ctx.quadraticCurveTo(32, 7, 20, 8); ctx.quadraticCurveTo(-8, 13, -30, 0); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-44, -10); ctx.lineTo(-37, 0); ctx.lineTo(-44, 10); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(-6, 8); ctx.quadraticCurveTo(8, 11, 20, 8); ctx.quadraticCurveTo(6, 10, -6, 8); ctx.fill()
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(22, -2, 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    if (spout > 0.01) {
      ctx.save(); ctx.globalAlpha = alpha * spout; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round'
      const sx = x + 26 * dir, sy = y - 5
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + i * 5, sy - 14, sx + i * 10, sy - 22 - Math.abs(i) * 2); ctx.stroke() }
      ctx.restore()
    }
  }
  function drawDolphin(x: number, y: number, alpha: number) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.fillStyle = '#475569'
    ctx.beginPath(); ctx.moveTo(-10, 5); ctx.quadraticCurveTo(0, -10, 11, 3); ctx.quadraticCurveTo(2, -2, -10, 5); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-1, -4); ctx.lineTo(2, -10); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  function drawTurtle(x: number, y: number, a: number, alpha: number) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.cos(a) * 0.3); ctx.globalAlpha = alpha
    ctx.fillStyle = '#166534'
    ctx.beginPath(); ctx.ellipse(-7, -5, 4, 2.2, -0.6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(7, -5, 4, 2.2, 0.6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(-6, 6, 3.4, 1.9, 0.6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(6, 6, 3.4, 1.9, -0.6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(0, -9, 2.4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#15803D'; ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 6.6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(240,253,244,0.55)'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(-4, -2.5); ctx.lineTo(4, -2.5); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke()
    ctx.restore()
  }
  function drawBuoy(x: number, y: number, on: boolean, alpha: number) {
    ctx.save(); ctx.globalAlpha = alpha
    if (on) {
      const gg = ctx.createRadialGradient(x, y - 9, 0, x, y - 9, 15)
      gg.addColorStop(0, 'rgba(255,90,70,0.75)'); gg.addColorStop(1, 'rgba(255,90,70,0)')
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y - 9, 15, 0, Math.PI * 2); ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + 4, 8, 2.4, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x - 3, y - 6); ctx.lineTo(x + 3, y - 6); ctx.lineTo(x + 5, y + 4); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x - 4, y - 2, 8, 2.6)
    ctx.fillStyle = on ? '#fee2e2' : '#7f1d1d'; ctx.beginPath(); ctx.arc(x, y - 8, 2, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath()
  }

  function draw(now: number) {
    if (!alive) return
    const t = (now - t0) / 1000
    if (!W || !H) { raf = requestAnimationFrame(draw); return }
    const L = LAYERS[layer] || LAYERS.all

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    if (themeDark) { g.addColorStop(0, '#1d4d57'); g.addColorStop(0.45, '#123842'); g.addColorStop(1, '#081d26') }
    else { g.addColorStop(0, '#8ccfd6'); g.addColorStop(0.45, '#3f97a6'); g.addColorStop(1, '#1c5566') }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const rg = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.75)
    rg.addColorStop(0, 'rgba(255,255,255,0.10)'); rg.addColorStop(1, 'rgba(6,40,52,0.25)')
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)

    ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale)

    // currents
    const dt = 1 / 60
    ctx.lineCap = 'round'
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const v = flow(p.x, p.y, t)
      p.px = p.x; p.py = p.y
      p.x += v.x * p.spd * dt * 3; p.y += v.y * p.spd * dt * 3; p.life -= 1
      if (p.life <= 0 || p.x < bounds.x0 - 20 || p.x > bounds.x1 + 20 || p.y < bounds.y0 - 20 || p.y > bounds.y1 + 20 || insideLand(p.x, p.y, 1.02)) {
        particles[i] = spawnP(); continue
      }
      const a = Math.min(1, p.life / 60) * 0.5 * L.cur
      ctx.strokeStyle = `rgba(226,248,251,${a})`
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke()
    }

    // life markers (under land so they can slip behind islands)
    if (L.life > 0.05) {
      const fa = t * 0.28, fcx = 640, fcy = 360, frx = 74, fry = 30
      const fx = fcx + Math.cos(fa) * frx, fy = fcy + Math.sin(fa) * fry
      const fang = Math.atan2(-Math.sin(fa) * fry, -Math.cos(fa) * frx) + Math.PI
      drawFish(fx, fy, fang, 1.1 * Math.min(1, L.life), 0.9 * Math.min(1, L.life))
      const fa2 = fa + 0.5
      drawFish(fcx + Math.cos(fa2) * frx, fcy + Math.sin(fa2) * fry, Math.atan2(-Math.sin(fa2) * fry, -Math.cos(fa2) * frx) + Math.PI, 0.7, 0.7 * Math.min(1, L.life))

      const cp = (t * 0.03) % 1
      const ccx = 600 - cp * 320, ccy = 250 + cp * 40 + Math.sin(t * 0.8) * 2
      drawCanoe(ccx, ccy, -0.12, Math.min(1, L.life))

      const bcx = 360 + Math.sin(t * 0.15) * 60, bcy = 120 + Math.cos(t * 0.11) * 24
      const flock = [[0, 0], [-14, 6], [14, 6], [-28, 13], [28, 13]]
      for (const [dx, dy] of flock) drawBird(bcx + dx, bcy + dy, 1, 0.85 * Math.min(1, L.life))

      const lifeA = Math.min(1, L.life)
      const wp = (t * 0.012) % 1, wx = -70 + wp * 1160, wy = 518 + Math.sin(t * 0.5) * 4
      const sp = (t * 0.18) % 1, spout = sp < 0.22 ? Math.sin((sp / 0.22) * Math.PI) : 0
      drawWhale(wx, wy, 1, 0.92 * lifeA, spout)
      ctx.save(); ctx.translate(wx - 52, wy + 16); ctx.scale(0.6, 0.6); drawWhale(0, 0, 1, 0.72 * lifeA, 0); ctx.restore()
      const dbx = 356 + ((t * 24) % 250)
      for (let dk = 0; dk < 3; dk++) { const arc = Math.max(0, Math.sin(t * 1.6 + dk * 0.7)); drawDolphin(dbx - dk * 20, 372 - arc * 22, lifeA * (0.4 + 0.6 * arc)) }
      const ta = t * 0.16; drawTurtle(772 + Math.cos(ta) * 24, 436 + Math.sin(ta) * 13, ta, lifeA)
    }
    drawBuoy(432, 336, Math.sin(t * 3) > 0.55, 0.9)

    // islands
    for (const isl of ISLANDS) {
      ctx.save()
      ctx.shadowColor = 'rgba(8,40,52,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6
      islandPath(ctx, isl, 1)
      const lg = ctx.createLinearGradient(isl.cx, isl.cy - isl.ry, isl.cx, isl.cy + isl.ry)
      lg.addColorStop(0, '#efe7d2'); lg.addColorStop(0.5, '#c8cfa8'); lg.addColorStop(1, '#9aae86')
      ctx.fillStyle = lg; ctx.fill()
      ctx.restore()
      islandPath(ctx, isl, 1); ctx.strokeStyle = 'rgba(245,240,226,0.9)'; ctx.lineWidth = 2.4; ctx.stroke()
      islandPath(ctx, isl, 0.72); ctx.fillStyle = 'rgba(122,145,110,0.5)'; ctx.fill()
    }

    // weather
    let rainbowDrawn = false
    for (let c = 0; c < clouds.length; c++) {
      const cl = clouds[c]
      cl.x += cl.vx * dt; cl.y += cl.vy * dt
      if (cl.x < bounds.x0 - 160) { clouds[c] = makeCloud(); clouds[c].x = bounds.x1 + rand(60, 260); continue }
      const baseA = 0.9 * L.cloud
      for (const q of cl.puffs) {
        const px = cl.x + q.dx * cl.s, py = cl.y + q.dy * cl.s, pr = q.r * cl.s
        const cg = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pr)
        cg.addColorStop(0, `rgba(255,255,255,${baseA})`)
        cg.addColorStop(0.7, `rgba(244,247,248,${baseA * 0.55})`)
        cg.addColorStop(1, 'rgba(226,232,236,0)')
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
      }
      if (cl.rain && L.rain > 0.05) {
        if (!rainbowDrawn && L.rain > 0.28) {
          rainbowDrawn = true
          ctx.save(); ctx.globalAlpha = 0.22 * L.rain; ctx.lineWidth = 3.2; ctx.lineCap = 'round'
          const bandsC = ['#f472b6', '#fb923c', '#fde047', '#4ade80', '#38bdf8', '#a78bfa']
          const rcx = cl.x + 34 * cl.s, rcy = cl.y + 96
          for (let bi = 0; bi < 6; bi++) { ctx.strokeStyle = bandsC[bi]; ctx.beginPath(); ctx.arc(rcx, rcy, 44 + bi * 3.4, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke() }
          ctx.restore()
        }
        ctx.strokeStyle = `rgba(173,203,214,${0.5 * L.rain})`; ctx.lineWidth = 1.1
        for (let r = 0; r < 14; r++) {
          const rx = cl.x + rand(-46, 46) * cl.s, ry = cl.y + 22 * cl.s + ((t * 90 + r * 33) % 46)
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9); ctx.stroke()
        }
      }
    }

    // reef dots
    for (let d2 = 0; d2 < SITES.length; d2++) {
      const st = SITES[d2], col = st.color, isSel = selected === st.id
      const pulse = (Math.sin(t * 2 + d2) + 1) / 2
      const baseR = isSel ? 11.5 : 8.5
      const ringR = baseR + 6 + pulse * (col === STATUS.green.c ? 5 : 10) * L.dot
      ctx.globalAlpha = (0.32 - pulse * 0.28) * L.dot + 0.04
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(st.x, st.y, ringR, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.x, st.y, baseR + 3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(st.x, st.y, baseR, 0, Math.PI * 2); ctx.fill()
      if (isSel) { ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(st.x, st.y, baseR + 4.5, 0, Math.PI * 2); ctx.stroke() }
      if (isSel || L.labels) {
        ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif'
        const tw = ctx.measureText(st.name).width
        const lx = st.x, ly = st.y - baseR - 20
        ctx.globalAlpha = 0.95; ctx.fillStyle = 'rgba(30,41,59,0.92)'
        roundRect(ctx, lx - tw / 2 - 8, ly - 12, tw + 16, 22, 7); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(st.name, lx, ly - 1); ctx.textAlign = 'start'; ctx.globalAlpha = 1
      }
    }

    ctx.restore()
    raf = requestAnimationFrame(draw)
  }

  function pick(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    const dx = (clientX - rect.left - ox) / scale, dy = (clientY - rect.top - oy) / scale
    let best: MapSite | null = null, bd = 900
    for (const s of SITES) {
      const d = (s.x - dx) * (s.x - dx) + (s.y - dy) * (s.y - dy)
      if (d < bd) { bd = d; best = s }
    }
    return best
  }

  function onPointer(e: PointerEvent) {
    const s = pick(e.clientX, e.clientY)
    if (s) { selected = selected === s.id ? null : s.id; onSelect(selected ? s : null) }
  }

  canvas.addEventListener('pointerdown', onPointer)
  const ro = new ResizeObserver(resize); ro.observe(canvas)
  resize(); raf = requestAnimationFrame(draw)

  return {
    sites: SITES,
    setLayer(l: MapLayer) { layer = l },
    setTheme(d: boolean) { themeDark = d },
    select(id: string | null) {
      selected = id
      const s = SITES.find(x => x.id === id)
      onSelect(s || null)
    },
    /** Push live site data (color/label/sst) keyed by the design's short site id. */
    update(dataById: Record<string, { color: string; label: string; sst: number | null }>) {
      for (const s of SITES) {
        const d = dataById[s.id]
        if (d) { s.color = d.color; s.label = d.label; s.sst = d.sst }
      }
    },
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointer)
    },
  }
}

#!/usr/bin/env python3
"""
Regenerate the QR code that points at the live dashboard.

    pip install segno                      # encoder only
    pip install segno opencv-python-headless   # encoder + the verify step
    python scripts/make_qr_code.py

Writes qr-dashboard.svg / .png / -bw.png into frontend/public/, so they deploy with
the app and stay reachable at <site>/qr-dashboard.svg.

Two choices worth keeping if you edit this:
  * Error correction H (30%). A projected or printed code picks up glare, low contrast
    and the odd thumb over a corner; H survives all three. The cost is a denser symbol,
    which is irrelevant at slide size.
  * A 4-module quiet zone. Cropping tight to the edge is the most common way people
    break a QR code, so the border is explicit rather than left to the caller.

If SHARE_URL changes, update CANONICAL_URL in
frontend/src/mobile/components/ShareQrModal.tsx to match — the modal prints the URL
as text next to the image, and the two drifting apart is the failure this comment
exists to prevent.
"""
from __future__ import annotations

import sys
from pathlib import Path

import segno

SHARE_URL = "https://kenethm.github.io/Hawaiian-Island-Ocean-Dashboard/"
INK = "#0b2c37"  # the dashboard's deep ocean navy
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "frontend" / "public"


def build(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    qr = segno.make(SHARE_URL, error="h")
    print(f"payload : {SHARE_URL}")
    print(f"symbol  : version {qr.version}, error correction H (30%)")

    svg = out_dir / "qr-dashboard.svg"      # vector — slides and print, any size
    png = out_dir / "qr-dashboard.png"      # raster in brand navy
    bw = out_dir / "qr-dashboard-bw.png"    # plain black on white — cheap scanners, photocopies

    qr.save(svg, kind="svg", scale=10, border=4, dark=INK, light="#ffffff")
    qr.save(png, kind="png", scale=24, border=4, dark=INK, light="#ffffff")
    qr.save(bw, kind="png", scale=24, border=4)

    print("\nwrote:")
    for f in (svg, png, bw):
        print(f"  {f.name:24} {f.stat().st_size / 1024:6.1f} KB")
    return [svg, png, bw]


def verify(png_files: list[Path]) -> bool:
    """Decode with OpenCV — a different implementation from the encoder, so this is a real
    check rather than asking segno whether segno was right."""
    try:
        import cv2
    except ImportError:
        print("\nSKIPPED verification (pip install opencv-python-headless to enable).")
        print("Scan it with a phone before using it anywhere that matters.")
        return True

    det = cv2.QRCodeDetector()
    ok = True
    print("\ndecode check:")
    for f in png_files:
        data, _, _ = det.detectAndDecode(cv2.imread(str(f)))
        hit = data == SHARE_URL
        ok &= hit
        verdict = "MATCH" if hit else f"MISMATCH: {data!r}"
        print(f"  {f.name:24} {verdict}")

    # It gets scanned off a slide or a handout, not at full resolution.
    print("\nstill readable when shrunk:")
    img = cv2.imread(str(png_files[0]))
    for px in (300, 200, 140):
        small = cv2.resize(img, (px, px), interpolation=cv2.INTER_AREA)
        data, _, _ = det.detectAndDecode(small)
        hit = data == SHARE_URL
        ok &= hit
        print(f"  {px:>4}x{px:<4} px           {'MATCH' if hit else 'FAILED to decode'}")
    return ok


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT_DIR
    written = build(out)
    passed = verify([f for f in written if f.suffix == ".png"])
    print("\nRESULT:", "all checks passed" if passed else "SOMETHING FAILED — do not use")
    sys.exit(0 if passed else 1)

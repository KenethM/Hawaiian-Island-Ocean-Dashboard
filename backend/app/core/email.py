"""
Email notifications via SMTP.

Required env vars (all optional — notifications silently skip if missing):
  SMTP_HOST      default: smtp.gmail.com
  SMTP_PORT      default: 587
  SMTP_USER      your SMTP login (e.g. you@gmail.com)
  SMTP_PASSWORD  app password or SMTP password
  SMTP_FROM      sender address (defaults to SMTP_USER)
"""

import os
import asyncio
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

log = logging.getLogger(__name__)

_SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
_SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
_SMTP_USER = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_SMTP_FROM = os.getenv("SMTP_FROM", "") or _SMTP_USER

ALERT_LEVEL_LABELS = {
    1: "Watch",
    2: "Warning",
    3: "Alert Level 1",
    4: "Alert Level 2",
}


def _send_sync(to_email: str, subject: str, html_body: str) -> None:
    """Blocking SMTP send — run inside a thread executor."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = _SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_FROM, [to_email], msg.as_string())


async def send_bleaching_alert(
    to_email: str,
    site_name: str,
    island: str,
    alert_level: int,
    dhw: float | None,
    hotspot: float | None,
) -> bool:
    """Send a bleaching alert email. Returns True on success, False on failure or misconfiguration."""
    if not (_SMTP_USER and _SMTP_PASSWORD):
        log.debug("SMTP not configured — skipping email to %s", to_email)
        return False

    label = ALERT_LEVEL_LABELS.get(alert_level, f"Level {alert_level}")
    dhw_str = f"{dhw:.1f} °C-weeks" if dhw is not None else "N/A"
    hotspot_str = f"+{hotspot:.2f}°C" if hotspot is not None else "N/A"

    subject = f"[Hawaii Reef Dashboard] Bleaching {label} at {site_name}"
    html_body = f"""
<html><body style="font-family:sans-serif;color:#1e293b;max-width:520px">
  <div style="background:#0c4a6e;padding:16px 20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Hawaii Coral Reef Health Dashboard</h2>
    <p style="color:#bae6fd;margin:4px 0 0;font-size:13px">Bleaching Alert Notification</p>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <p style="font-size:15px;margin-top:0">
      A <strong>{label}</strong> has been issued for <strong>{site_name}</strong> ({island}).
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr>
        <td style="padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">Alert Level</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0">{label}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">Degree Heating Weeks</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0">{dhw_str}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">Hotspot</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0">{hotspot_str}</td>
      </tr>
    </table>
    <p style="font-size:12px;color:#64748b;margin-top:20px">
      You subscribed to alerts for {site_name}. To unsubscribe, sign in to the dashboard and remove this site from your subscriptions.
    </p>
    <p style="font-size:12px;color:#64748b;margin-bottom:0">
      Data source: NOAA Coral Reef Watch (CRW)
    </p>
  </div>
</body></html>
"""

    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _send_sync, to_email, subject, html_body)
        log.info("Bleaching alert email sent to %s for %s (%s)", to_email, site_name, label)
        return True
    except Exception as exc:
        log.warning("Failed to send alert email to %s: %s", to_email, exc)
        return False

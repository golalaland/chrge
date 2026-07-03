/**
 * geoLookup.js
 * ------------------------------------------------------------
 * Approximate IP-based geolocation for scan records.
 *
 * HONEST LIMITS: IP geolocation is approximate, not precise —
 * it typically resolves to city/region level at best, is often
 * wrong for mobile carriers (which route traffic through
 * regional gateways far from the actual device), and is
 * trivially defeated by a VPN. Treat every location in this
 * system as "probably roughly here," not a precise fact — this
 * matters for how the counterfeit-detection logic downstream
 * should weigh it (a signal to investigate, not proof of fraud).
 *
 * This uses ip-api.com's free tier (no API key, 45 req/min rate
 * limit) as a placeholder that works out of the box. For
 * production at real scale, swap in a paid provider with an SLA
 * — MaxMind GeoIP2, ipapi.co paid tier, or similar — by
 * replacing the fetch call below. The rest of the system doesn't
 * need to change.
 * ------------------------------------------------------------
 */

async function lookupIPLocation(ip) {
  // Local/private IPs (emulator testing, internal traffic) can't
  // be geolocated — return null rather than a misleading guess.
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
    return null;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success') return null;

    return {
      country: data.country || null,
      countryCode: data.countryCode || null,
      region: data.regionName || null,
      city: data.city || null,
      lat: data.lat ?? null,
      lon: data.lon ?? null
    };
  } catch (err) {
    console.error('Geolocation lookup failed:', err.message);
    return null; // fail open — never block verification because geolocation failed
  }
}

/**
 * Extracts the caller's IP from a Cloud Functions v2 onRequest
 * request, accounting for the fact that Firebase Hosting/Cloud
 * Run sits behind a proxy — the real client IP is in
 * X-Forwarded-For, not req.ip directly.
 */
function extractClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
}

module.exports = { lookupIPLocation, extractClientIP };

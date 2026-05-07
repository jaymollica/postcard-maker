// Thin wrapper around Umami's window.umami.track(). Safely no-ops if Umami
// hasn't loaded yet (or is disabled in dev). Always attaches the referring
// artist domain when the URL carries an ?artistUrl=... so every event can be
// sliced by which artist site sent the visitor.

function getReferringDomain() {
  try {
    const params = new URLSearchParams(window.location.search);
    const artistUrl = params.get('artistUrl');
    if (!artistUrl) return null;
    return new URL(artistUrl).host || null;
  } catch (e) {
    return null;
  }
}

export function track(eventName, data) {
  if (typeof window === 'undefined') return;
  if (!window.umami || typeof window.umami.track !== 'function') return;
  const referring_domain = getReferringDomain();
  const payload = referring_domain ? { ...(data || {}), referring_domain } : data;
  try {
    if (payload && Object.keys(payload).length > 0) {
      window.umami.track(eventName, payload);
    } else {
      window.umami.track(eventName);
    }
  } catch (e) {
    // Tracking should never break the page.
  }
}

export const CONSENT_VERSION = 'tva-google-measurement-2026-10-21-v1'

export function leadTrackingFields(body, at = new Date()) {
  const fields = { sourcePage: 'https://travel-visa.com.ua/' }
  try {
    const page = new URL(body.sourcePage)
    if (page.protocol === 'https:' && !page.username && !page.password &&
      ['travel-visa.com.ua', 'www.travel-visa.com.ua'].includes(page.hostname) && page.href.length <= 2000) {
      fields.sourcePage = `${page.origin}${page.pathname}`
    }
  } catch { /* Optional attribution must not block the existing lead delivery. */ }
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (typeof body[key] === 'string' && body[key].length <= 500) fields[key] = body[key]
  }
  const approved = body.marketingConsent === true && body.marketingConsentVersion === CONSENT_VERSION
  fields.google_ad_user_data = approved ? 'GRANTED' : 'DENIED'
  fields.google_ad_personalization = 'DENIED'
  fields.google_consent_at = at.toISOString()
  fields.google_consent_version = CONSENT_VERSION
  if (approved) for (const key of ['gclid', 'gbraid', 'wbraid']) {
    if (typeof body[key] === 'string' && /^[A-Za-z0-9_-]{10,512}$/.test(body[key])) fields[key] = body[key]
  }
  return fields
}

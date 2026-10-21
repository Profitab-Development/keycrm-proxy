import test from 'node:test'
import assert from 'node:assert/strict'
import { leadTrackingFields, CONSENT_VERSION } from '../lib/lead-tracking.js'

const at = new Date('2026-10-21T09:00:00Z')
test('legacy submissions cannot grant Google consent', () => {
  const result = leadTrackingFields({ name: 'Example', phone: '+380000000000', gclid: 'GoogleCaseSensitive123' }, at)
  assert.equal(result.google_ad_user_data, 'DENIED')
  assert.equal(result.gclid, undefined)
  assert.equal(result.name, undefined)
  assert.equal(result.phone, undefined)
})
test('explicit current consent preserves all valid click IDs and uses server time', () => {
  const result = leadTrackingFields({ marketingConsent: true, marketingConsentVersion: CONSENT_VERSION,
    gclid: 'GoogleCaseSensitive123', gbraid: 'ValidBraid_123456', wbraid: 'ValidWbraid_12345',
    google_consent_at: '1900-01-01T00:00:00Z', google_ad_personalization: 'GRANTED',
    sourcePage: 'https://travel-visa.com.ua/?phone=private&gclid=abc', utm_campaign: 'US Visa' }, at)
  assert.equal(result.gclid, 'GoogleCaseSensitive123')
  assert.equal(result.gbraid, 'ValidBraid_123456')
  assert.equal(result.wbraid, 'ValidWbraid_12345')
  assert.equal(result.sourcePage, 'https://travel-visa.com.ua/')
  assert.equal(result.google_consent_at, at.toISOString())
  assert.equal(result.google_ad_personalization, 'DENIED')
  assert.equal(result.utm_campaign, 'US Visa')
})
test('invalid versions, string consent and untrusted pages fail closed', () => {
  for (const input of [ { marketingConsent: 'true', marketingConsentVersion: CONSENT_VERSION },
    { marketingConsent: true, marketingConsentVersion: 'old' } ]) {
    assert.equal(leadTrackingFields(input, at).google_ad_user_data, 'DENIED')
  }
  const result = leadTrackingFields({ marketingConsent: true, marketingConsentVersion: CONSENT_VERSION,
    sourcePage: 'https://travel-visa.com.ua.evil.example/', gclid: 'bad%ID', utm_source: ['bad'],
    utm_campaign: 'x'.repeat(501), secret: 'never-forward' }, at)
  assert.equal(result.sourcePage, 'https://travel-visa.com.ua/')
  assert.equal(result.gclid, undefined)
  assert.equal(result.utm_source, undefined)
  assert.equal(result.utm_campaign, undefined)
  assert.equal(result.secret, undefined)
})

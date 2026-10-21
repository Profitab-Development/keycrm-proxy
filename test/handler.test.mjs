import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/keycrm.js'
import { CONSENT_VERSION } from '../lib/lead-tracking.js'

test('existing KeyCRM and CRM delivery remain single and tracking reaches only the CRM webhook', async () => {
  const originalFetch = globalThis.fetch
  const old = { token: process.env.KEYCRM_TOKEN, url: process.env.LEAD_WEBHOOK_URL, secret: process.env.LEAD_WEBHOOK_SECRET }
  const calls = []
  process.env.KEYCRM_TOKEN = 'fixture-token'
  process.env.LEAD_WEBHOOK_URL = 'https://crm.example.test/api/crm/website'
  process.env.LEAD_WEBHOOK_SECRET = 'fixture-secret'
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    return Response.json({ id: 123, manager_id: 1 })
  }
  try {
    const req = { method: 'POST', headers: { origin: 'https://travel-visa.com.ua' }, body: {
      name: 'Fixture', phone: '+380000000000', marketingConsent: true,
      marketingConsentVersion: CONSENT_VERSION, gclid: 'GoogleCase123456', utm_campaign: 'US visas' } }
    const res = { setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    await handler(req, res)
    assert.equal(res.code, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].url, 'https://openapi.keycrm.app/v1/pipelines/cards')
    assert.equal(calls[0].body.contact.phone, req.body.phone)
    assert.equal(calls[0].body.gclid, undefined)
    assert.equal(calls[1].url, process.env.LEAD_WEBHOOK_URL)
    assert.equal(calls[1].headers['X-Webhook-Secret'], 'fixture-secret')
    assert.equal(calls[1].body.gclid, 'GoogleCase123456')
    assert.equal(calls[1].body.utm_campaign, 'US visas')
    assert.equal(calls[1].body.created_at, calls[1].body.google_consent_at)
    assert.equal(calls[1].body.google_ad_user_data, 'GRANTED')
    assert.equal(calls[1].body.google_ad_personalization, 'DENIED')
    assert.equal(calls[1].body.source, 'travel-visa.com.ua')
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries({ KEYCRM_TOKEN: old.token, LEAD_WEBHOOK_URL: old.url, LEAD_WEBHOOK_SECRET: old.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
  }
})

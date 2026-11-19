import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/keycrm.js'
import { VISA_TYPES } from '../lib/consultation.js'

const inquiry = () => ({ attemptId: 'c243e562-47e6-4d48-988b-e2f036a657f4', createdAt: new Date().toISOString(), name: ' Fixture ', phone: '+380501234567', consent: true, visaType: VISA_TYPES[1], formSource: 'offers', language: 'pl' })
function response() { return { setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } } }
async function scenario(callback) {
  const originalFetch = globalThis.fetch
  const env = { ...process.env }
  process.env.LEAD_WEBHOOK_URL = 'https://crm.example.test/api/crm/website'
  process.env.LEAD_WEBHOOK_SECRET = 'fixture-secret'
  process.env.KEYCRM_TOKEN = 'fixture-token'
  try { await callback() } finally {
    globalThis.fetch = originalFetch
    for (const key of ['LEAD_WEBHOOK_URL', 'LEAD_WEBHOOK_SECRET', 'KEYCRM_TOKEN']) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]
    }
  }
}
const request = body => ({ method: 'POST', headers: { origin: 'https://travel-visa.com.ua' }, body })

test('only CRM acceptance produces the matching receipt; choice reaches both systems', async () => scenario(async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init, body: JSON.parse(init.body) })
    return url.includes('crm.example') ? Response.json({ leadId: 123, duplicate: false }) : Response.json({ id: 321 })
  }
  const body = inquiry(), res = response()
  await handler(request(body), res)
  assert.equal(res.code, 200)
  assert.deepEqual(res.body, { ok: true, receiptId: body.attemptId, duplicate: false })
  assert.equal(calls[0].body.created_at, body.createdAt)
  assert.equal(calls[0].body.visaType, body.visaType)
  assert.equal(calls[0].body.name, 'Fixture')
  assert.equal(calls[0].body.google_ad_user_data, 'DENIED')
  assert.equal(calls[1].body.title, `Заявка з сайту — ${body.visaType} — Fixture`)
}))

test('a retry after a lost response keeps CRM deduplication identity and skips another secondary card', async () => scenario(async () => {
  const payloads = []
  globalThis.fetch = async (url, init) => {
    assert.equal(url, process.env.LEAD_WEBHOOK_URL)
    payloads.push(JSON.parse(init.body))
    return Response.json({ leadId: 123, duplicate: true })
  }
  const body = inquiry()
  for (let i = 0; i < 2; i++) {
    const res = response(); await handler(request(body), res)
    assert.equal(res.body.duplicate, true)
  }
  assert.equal(payloads.length, 2)
  assert.equal(payloads[0].created_at, payloads[1].created_at)
  assert.equal(payloads[0].phone, payloads[1].phone)
}))

test('CRM failure, malformed acknowledgement and network rejection never produce success', async () => scenario(async () => {
  for (const mock of [async () => Response.json({ leadId: 123 }, { status: 503 }), async () => Response.json({ ok: true }), async () => { throw new Error('offline') }]) {
    globalThis.fetch = mock
    const res = response(); await handler(request(inquiry()), res)
    assert.equal(res.code, 503)
    assert.equal(res.body.ok, undefined)
  }
}))

test('validation, explicit consent and trusted origins are checked before forwarding', async () => scenario(async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('must not call') }
  for (const change of [{ consent: false }, { name: ' ' }, { phone: '0501234567' }, { createdAt: '2026-02-30T12:00:00.000Z' }, { visaType: 'anything' }, { attemptId: 'invalid' }, { formSource: 'injected' }]) {
    const res = response(); await handler(request({ ...inquiry(), ...change }), res)
    assert.equal(res.code, 422)
  }
  const res = response(), req = request(inquiry()); req.headers.origin = 'https://untrusted.example'
  await handler(req, res); assert.equal(res.code, 403)
  assert.equal(calls, 0)
}))

test('a failed secondary copy cannot turn an accepted CRM inquiry into a retry', async () => scenario(async () => {
  globalThis.fetch = async url => url.includes('crm.example') ? Response.json({ leadId: 1, duplicate: false }) : Response.json({}, { status: 503 })
  const res = response(); await handler(request(inquiry()), res)
  assert.equal(res.code, 200)
  assert.equal(res.body.ok, true)
}))

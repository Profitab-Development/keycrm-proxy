import { leadTrackingFields } from './lead-tracking.js'

export const VISA_TYPES = [
  'Туристична віза в США', 'Гостьова віза в США', 'Бізнес віза в США',
  'Навчальна віза в США', 'Транзитна віза в США', 'Інші типи віз в США',
]

function validInquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const { attemptId, createdAt, consent, visaType = '', formSource, language } = body
  if (typeof attemptId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(attemptId)) return null
  if (consent !== true || typeof body.name !== 'string' || typeof body.phone !== 'string') return null
  const name = body.name.trim(), phone = body.phone.trim()
  if (name.length < 2 || name.length > 100 || !/^\+[1-9]\d{7,14}$/.test(phone)) return null
  if (visaType !== '' && !VISA_TYPES.includes(visaType)) return null
  if (!['hero', 'offers', 'bottom'].includes(formSource) || !['uk', 'pl', 'en'].includes(language)) return null
  if (typeof createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt)) return null
  const time = new Date(createdAt)
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== createdAt || time.getTime() > Date.now() + 300000) return null
  return { attemptId, createdAt, name, phone, visaType, formSource, language }
}

export async function receiveConsultation(req, res) {
  const inquiry = validInquiry(req.body)
  if (!inquiry) return res.status(422).json({ error: 'Check the inquiry fields' })
  if (!process.env.LEAD_WEBHOOK_URL || !process.env.LEAD_WEBHOOK_SECRET)
    return res.status(503).json({ error: 'CRM delivery unavailable' })
  try {
    const response = await fetch(process.env.LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': process.env.LEAD_WEBHOOK_SECRET },
      body: JSON.stringify({
        name: inquiry.name, phone: inquiry.phone, source: 'travel-visa.com.ua',
        // Stable across retries: the CRM deduplicates by phone + this timestamp.
        created_at: inquiry.createdAt, visaType: inquiry.visaType,
        formSource: inquiry.formSource, language: inquiry.language,
        ...leadTrackingFields(req.body),
      }),
      signal: AbortSignal.timeout(10000),
    })
    const receipt = await response.json().catch(() => null)
    if (!response.ok || !Number.isSafeInteger(receipt?.leadId) || receipt.leadId <= 0)
      return res.status(503).json({ error: 'CRM did not acknowledge the inquiry' })

    // Retain the existing secondary KeyCRM copy once per CRM acceptance.
    // A retry after a lost response must not create another KeyCRM card.
    if (!receipt.duplicate && process.env.KEYCRM_TOKEN) {
      try {
        const copy = await fetch('https://openapi.keycrm.app/v1/pipelines/cards', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.KEYCRM_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            pipeline_id: 1, source_id: 4,
            title: `Заявка з сайту${inquiry.visaType ? ` — ${inquiry.visaType}` : ''} — ${inquiry.name}`,
            contact: { phone: inquiry.phone, full_name: inquiry.name },
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (!copy.ok) console.warn('Secondary KeyCRM delivery failed: HTTP', copy.status)
      } catch { console.warn('Secondary KeyCRM delivery unavailable') }
    }
    return res.status(200).json({ ok: true, receiptId: inquiry.attemptId, duplicate: receipt.duplicate === true })
  } catch {
    // No raw response or contact data in public errors or logs.
    return res.status(503).json({ error: 'CRM delivery unavailable; retry the same inquiry' })
  }
}

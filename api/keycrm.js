// export default async function handler(req, res) {
//   res.setHeader('Access-Control-Allow-Origin', 'https://travel-visa.com.ua')
//   res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

//   if (req.method === 'OPTIONS') {
//     return res.status(200).end()
//   }

//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' })
//   }

//   const { name, phone } = req.body

//   const contact = { phone }
//   if (name) contact.full_name = name

//   const response = await fetch('https://openapi.keycrm.app/v1/pipelines/cards', {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${process.env.KEYCRM_TOKEN}`,
//       'Content-Type': 'application/json',
//       'Accept': 'application/json',
//     },
//     body: JSON.stringify({
//       pipeline_id: 1,
//       source_id: 4,
//       title: `Заявка з сайту${name ? ' — ' + name : ''}`,
//       contact,
//     }),
//   })

//   const data = await response.json()

//   if (response.ok) {
//     return res.status(200).json({ success: 'Lead created!' })
//   } else {
//     return res.status(400).json({ error: data })
//   }
// }


const ALLOWED_ORIGINS = [
  'https://travel-visa.com.ua',
  'https://www.travel-visa.com.ua',
]

export default async function handler(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, phone } = req.body

  const contact = { phone }
  if (name) contact.full_name = name

  const payload = {
    pipeline_id: 1,
    source_id: 4,
    manager_id: 9,
    title: `Заявка з сайту${name ? ' — ' + name : ''}`,
    contact,
  }

  console.log('KeyCRM request:', JSON.stringify(payload))

  const response = await fetch('https://openapi.keycrm.app/v1/pipelines/cards', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KEYCRM_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  console.log('KeyCRM response:', response.status, JSON.stringify(data))

  if (response.ok) {
    return res.status(200).json({ success: 'Lead created!' })
  } else {
    return res.status(400).json({ error: data })
  }
}

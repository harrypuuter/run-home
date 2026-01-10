// Usage: TRANSITLAND_API_KEY=<key> node scripts/transitland_demo.js <onestop_id>
// Example: TRANSITLAND_API_KEY=... node scripts/transitland_demo.js s-u336w9csys-berlincunostr

const fetch = global.fetch || require('node-fetch')
const BASE = 'https://transit.land/api/v2/rest'

async function fetchJson(url) {
  const res = await fetch(url)
  const txt = await res.text()
  try { return JSON.parse(txt) } catch (e) { throw new Error(`Failed to parse JSON (${res.status}): ${txt.slice(0,200)}`) }
}

async function main() {
  const key = process.env.TRANSITLAND_API_KEY
  if (!key) {
    console.error('Missing TRANSITLAND_API_KEY env var. Set it and re-run.')
    process.exit(2)
  }
  const onestop = process.argv[2]
  if (!onestop) {
    console.error('Provide onestop_id as first argument')
    process.exit(2)
  }

  console.log('Checking stop:', onestop)
  const stopUrl = `${BASE}/stops/${encodeURIComponent(onestop)}?apikey=${encodeURIComponent(key)}`
  const stopJson = await fetchJson(stopUrl).catch(e => { console.error('Stop fetch failed:', e.message); process.exit(1) })
  console.log('\nStop:')
  console.log(`  Name: ${stopJson.name}`)
  console.log(`  Onestop ID: ${stopJson.onestop_id}`)
  console.log(`  Location: ${stopJson.geometry?.coordinates?.[1] || 'n/a'}, ${stopJson.geometry?.coordinates?.[0] || 'n/a'}`)

  const routesUrl = `${BASE}/routes?stop_onestop_id=${encodeURIComponent(onestop)}&per_page=50&apikey=${encodeURIComponent(key)}`
  const routesJson = await fetchJson(routesUrl).catch(e => { console.error('Routes fetch failed:', e.message); process.exit(1) })
  const routes = routesJson.routes || []
  console.log('\nFound', routes.length, 'routes using this stop. Showing up to 30:')

  const display = async (r) => {
    const id = r.onestop_id
    // Optionally fetch details
    const routeUrl = `${BASE}/routes/${encodeURIComponent(id)}?apikey=${encodeURIComponent(key)}`
    let details = null
    try { details = await fetchJson(routeUrl) } catch (e) { details = null }

    return {
      onestop_id: id,
      short_name: r.route_short_name || (details && details.route_short_name) || null,
      name: r.name || (details && details.name) || null,
      operator: (r.operator && r.operator.name) || (details && details.operator && details.operator.name) || '—',
      mode: (r.mode || (details && details.mode) || '') .toString().replace(/_/g, ' '),
      route_type: r.route_type || (details && details.route_type) || null,
      desc: (details && details.route_desc) || r.route_desc || null,
    }
  }

  const sampled = routes.slice(0, 30)
  const rows = []
  for (const r of sampled) {
    const d = await display(r)
    rows.push(d)
  }

  for (const r of rows) {
    console.log('\n---------------------------')
    console.log(`Number: ${r.short_name || '(no short name)'}\n  Name: ${r.name || '(no name)'}\n  Operator: ${r.operator}\n  Mode: ${r.mode || '(n/a)'}\n  Type: ${r.route_type || '(n/a)'}\n  Onestop ID: ${r.onestop_id}`)
    if (r.desc) console.log(`  Description: ${r.desc}`)
  }

  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1) })

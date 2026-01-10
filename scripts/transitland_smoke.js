// Simple Transitland smoke test script
// Usage: TRANSITLAND_API_KEY=<key> node scripts/transitland_smoke.js

async function run() {
  const key = process.env.TRANSITLAND_API_KEY
  if (!key) {
    console.error('Missing TRANSITLAND_API_KEY env var. Set it and re-run.')
    process.exit(2)
  }

  const base = 'https://transit.land/api/v2/rest'
  const lat = 52.52
  const lon = 13.405
  const qs = (params) => new URLSearchParams(params).toString()

  try {
    console.log('→ GET /stops (near Berlin)')
    const stopsRes = await fetch(`${base}/stops?${qs({ lat, lon, radius: 1000, apikey: key })}`)
    console.log('Status:', stopsRes.status)
    const stopsJson = await stopsRes.json().catch(() => null)
    console.log('Sample:', JSON.stringify(stopsJson && stopsJson.stops ? stopsJson.stops.slice(0,3).map(s => ({id: s.onestop_id, name: s.name, lat: s.geometry?.coordinates?.[1], lon: s.geometry?.coordinates?.[0]})) : stopsJson, null, 2))

    console.log('\n→ GET /departures (near Berlin)')
    const depRes = await fetch(`${base}/departures?${qs({ lat, lon, radius: 1000, apikey: key })}`)
    console.log('Status:', depRes.status)
    const depJson = await depRes.json().catch(() => null)
    console.log('Sample departures count:', depJson && depJson.departures ? depJson.departures.length : 'N/A')
    if (depJson && depJson.departures && depJson.departures.length) {
      console.log('First departure:', JSON.stringify(depJson.departures[0], null, 2))
    }

    process.exit(0)
  } catch (e) {
    console.error('Error during transitland smoke:', e.message || e)
    process.exit(1)
  }
}

run()

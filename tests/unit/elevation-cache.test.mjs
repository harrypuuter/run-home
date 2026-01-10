import assert from 'assert'
import { _clearElevationCache, _setCacheEntryForTest, _setCacheEntryWithTs, _evictOldEntries, _cacheSize, cacheKey } from '../../src/services/elevation.js'

// Simple tests for cache eviction (TTL behavior)
;(async () => {
  _clearElevationCache()
  assert.strictEqual(_cacheSize(), 0, 'Cache should start empty')

  _setCacheEntryForTest(cacheKey(52.52, 13.405), 100)
  _setCacheEntryForTest(cacheKey(48.13, 11.58), 200)
  assert.strictEqual(_cacheSize(), 2, 'Cache should have 2 entries')

  // Insert an old entry (simulate a timestamp far in the past)
  const oldTs = Date.now() - 1000 * 60 * 60 * 24 * 365 // 1 year old
  _setCacheEntryWithTs(cacheKey(50.0, 10.0), 300, oldTs)
  assert.strictEqual(_cacheSize(), 3, 'Cache should have 3 entries after adding old entry')

  // Run eviction and ensure old entry is removed
  _evictOldEntries()
  const sizeAfter = _cacheSize()
  assert.strictEqual(sizeAfter, 2, 'Old entry should be evicted by TTL')

  console.log('✓ elevation cache TTL eviction tests passed')
})().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})

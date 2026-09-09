import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  buildUpsertSql,
  buildConsensusPlaces,
  buildCoverageReport,
  loadPlacePool,
  renderCoverageMarkdown,
  validatePlacePool,
} from '../scripts/import-couple-place-pool.mjs'

const pool = loadPlacePool()

test('Phase 1B-1 pool has 24 real venues and no generic fixture names', () => {
  const validation = validatePlacePool(pool)
  assert.deepEqual(validation.errors, [])
  assert.equal(pool.venues.length, 24)
  assert.equal(pool.items.length, 27)
  assert.deepEqual(
    Object.fromEntries(['seongsu', 'hongdae', 'jongno_euljiro'].map((area) => [area, pool.venues.filter((venue) => venue.meeting_area === area).length])),
    { seongsu: 8, hongdae: 8, jongno_euljiro: 8 },
  )
})

test('approved Editorial review is complete and reject Items are inactive', () => {
  const tiers = Object.fromEntries(['hero', 'standard', 'coverage', 'reject'].map((tier) => [
    tier,
    pool.items.filter((item) => item.editorial_tier === tier).length,
  ]))
  assert.deepEqual(tiers, { hero: 4, standard: 10, coverage: 4, reject: 9 })
  assert.ok(pool.items.every((item) => item.curation_origin === 'independent_couple_research'))
  assert.ok(pool.items.every((item) => item.editorial_evidence_refs.length > 0))
  assert.ok(pool.items.filter((item) => item.editorial_tier === 'reject').every((item) => item.status === 'inactive'))
  assert.equal(pool.items.find((item) => item.source_key === 'item-seoul-museum-of-history-permanent').status, 'inactive')
  assert.equal(pool.venues.find((venue) => venue.source_key === 'venue-seoul-museum-of-history').status, 'active')
  assert.equal(pool.items.find((item) => item.source_key === 'event-seoul-city-planning-exhibition-2026').status, 'active')
})

test('Availability gate excludes registration-closed hero without changing its Editorial tier', () => {
  const report = buildCoverageReport(pool)
  const najeon = pool.items.find((item) => item.source_key === 'event-semoca-najeon-box-2026')
  assert.equal(najeon.editorial_tier, 'hero')
  assert.equal(najeon.availability_status, 'registration_closed')
  assert.equal(report.totals.items, 27)
  assert.equal(report.totals.eligible_items, 17)
  assert.equal(report.totals.primary_eligible_items, 10)
})

test('Couple production items map to Consensus input without Family derivation fields', () => {
  const places = buildConsensusPlaces(pool)
  assert.equal(places.length, 27)
  assert.ok(places.every((place) => place.datasetKind === 'production'))
  assert.ok(places.every((place) => place.activityType === place.primaryActivityType))
  assert.ok(places.every((place) => Array.isArray(place.secondaryActivityTypes)))
  assert.ok(places.every((place) => !Object.hasOwn(place, 'familyPlaceId') && !Object.hasOwn(place, 'derivedFromFamilyId')))

  const forbidden = structuredClone(pool)
  forbidden.items[0].family_place_id = 'family-1'
  assert.equal(validatePlacePool(forbidden).ok, false)
  assert.throws(() => loadPlacePool('src/data/places.js'), /독립 Couple 데이터/)
})

test('primary/secondary activity는 기존 trait 합집합과 일치하고 cafe veto 의미를 분리한다', () => {
  assert.ok(pool.items.every((item) => {
    const declared = new Set([item.primary_activity_type, ...item.secondary_activity_types])
    return declared.size === item.activity_traits.length
      && item.activity_traits.every((trait) => declared.has(trait))
  }))
  const lcdc = pool.items.find((item) => item.source_key === 'item-lcdc-seoul-visit')
  assert.equal(lcdc.primary_activity_type, 'walk_culture')
  assert.deepEqual(lcdc.secondary_activity_types, ['cafe', 'exhibition_popup'])
})

test('Kakao identity belongs to Venue and one Venue supports multiple Event items', () => {
  assert.equal(new Set(pool.venues.map((venue) => venue.kakao_place_id)).size, pool.venues.length)
  assert.ok(pool.items.every((item) => !Object.hasOwn(item, 'kakao_place_id')))
  const semocaEvents = pool.items.filter((item) => item.item_kind === 'event' && item.venue_source_key === 'venue-seoul-museum-of-craft-art')
  assert.equal(semocaEvents.length, 2)
})

test('recent and temporary freshness cannot omit lifecycle dates', () => {
  const invalid = structuredClone(pool)
  const recent = invalid.items.find((item) => item.freshness_class === 'recent')
  recent.freshness_expires_at = null
  const validation = validatePlacePool(invalid)
  assert.equal(validation.ok, false)
  assert.ok(validation.errors.some((error) => error.includes('freshness_expires_at')))
})

test('stale recent items lose new coverage instead of staying new forever', () => {
  const lifecyclePool = structuredClone(pool)
  lifecyclePool.items.forEach((item) => {
    item.editorial_review_due_at = '2027-12-31T00:00:00+09:00'
    item.availability_review_due_at = '2027-12-31T00:00:00+09:00'
  })
  const beforeExpiry = buildCoverageReport(lifecyclePool, '2026-09-01T00:00:00+09:00')
  const afterExpiry = buildCoverageReport(lifecyclePool, '2026-10-25T00:00:00+09:00')
  assert.ok(beforeExpiry.areas.seongsu.novelty.new > afterExpiry.areas.seongsu.novelty.new)
  assert.ok(afterExpiry.areas.seongsu.novelty.balanced > beforeExpiry.areas.seongsu.novelty.balanced)
})

test('temporary items are automatically excluded after valid_until', () => {
  const during = buildCoverageReport(pool, '2026-09-15T00:00:00+09:00')
  const after = buildCoverageReport(pool, '2027-01-02T00:00:00+09:00')
  assert.ok(during.totals.eligible_items > after.totals.eligible_items)
})

test('price validation distinguishes free, required and typical spend', () => {
  const invalid = structuredClone(pool)
  const freeItem = invalid.items.find((item) => item.price_band === 'free')
  freeItem.required_spend_per_person = 1000
  assert.equal(validatePlacePool(invalid).ok, false)

  const paid = pool.items.find((item) => item.source_key === 'item-ring-university-hongdae')
  assert.equal(paid.price_basis, 'program_fee')
  assert.equal(paid.typical_spend_per_person, paid.required_spend_per_person)
})

test('coverage report exposes pilot gaps instead of treating per-area count as beta readiness', () => {
  const report = buildCoverageReport(pool)
  assert.equal(report.beta_ready, false)
  assert.ok(Object.values(report.areas).some((area) => area.gaps.length > 0))
  assert.match(renderCoverageMarkdown(report), /다음 보강 gap/)
})

test('generated SQL is additive and idempotent', () => {
  const sql = buildUpsertSql(pool)
  assert.match(sql, /on conflict \(source_key\) do update/)
  assert.doesNotMatch(sql, /\b(delete|truncate|drop)\b/i)
  assert.match(sql, /begin;[\s\S]*commit;/)
  assert.match(sql, /editorial_tier/)
  assert.match(sql, /availability_status/)
  assert.doesNotMatch(sql, /family_place_id|derived_from_family_id/i)
})

test('Couple schema has no Family FK, sync trigger, or derivation identifier', () => {
  const schema = [
    'supabase/migrations/202608310002_create_couple_place_pool.sql',
    'supabase/migrations/202608310003_add_couple_editorial_availability_gate.sql',
  ].map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  assert.doesNotMatch(schema, /family_place_id|derived_from_family_id/i)
  assert.doesNotMatch(schema, /references\s+public\.(reviews|review_reports|account_deletion_requests|places)\b/i)
  assert.doesNotMatch(schema, /create\s+(?:or\s+replace\s+)?trigger[^;]*family/i)
})

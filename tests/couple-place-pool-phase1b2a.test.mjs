import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCoverageReport,
  buildUpsertSql,
  loadPhase1B2APlacePool,
  validatePlacePool,
} from '../scripts/import-couple-place-pool.mjs'
import { runPhase1B2AQualityHarness } from '../scripts/run-couple-phase1b2a-quality.mjs'
import { coupleFixturePlaces, FIXTURE_DATASET_VERSION } from '../supabase/functions/_shared/couple-fixtures.mjs'

const pool = loadPhase1B2APlacePool()

test('Phase 1B-2A는 독립 조사한 63 Venue / 71 Item으로 검증된다', () => {
  const validation = validatePlacePool(pool)
  assert.deepEqual(validation.errors, [])
  assert.equal(pool.dataset_version, 'couple-production-phase1b2a-v1')
  assert.equal(pool.venues.length, 63)
  assert.equal(pool.items.length, 71)
  assert.ok(pool.items.every((item) => item.curation_origin === 'independent_couple_research'))
  assert.ok(pool.items.every((item) => !Object.hasOwn(item, 'family_place_id') && !Object.hasOwn(item, 'derived_from_family_id')))
})

test('Human Gate 이후 추천 가능 58개와 primary 20개가 정확히 반영된다', () => {
  const report = buildCoverageReport(pool, '2026-09-01T03:00:00.000Z')
  assert.equal(report.totals.eligible_items, 58)
  assert.equal(report.totals.primary_eligible_items, 20)
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.areas).map(([area, value]) => [area, value.eligible_item_count])),
    { seongsu: 20, hongdae: 19, jongno_euljiro: 19 },
  )
  assert.equal(report.quality_checks.phase1b2a_area_target_met, false)
  assert.ok(report.quality_checks.human_curation_reviews_complete)
  assert.ok(Object.values(report.areas).every((area) => area.gaps.length === 0))
})

test('primary/secondary 활동 합집합과 cafe veto 의미가 확장 Item에도 유지된다', () => {
  assert.ok(pool.items.every((item) => {
    const activities = new Set([item.primary_activity_type, ...item.secondary_activity_types])
    return activities.size === item.activity_traits.length
      && item.activity_traits.every((activity) => activities.has(activity))
  }))
  const haus = pool.items.find((item) => item.source_key === 'item-haus-nowhere-seoul')
  assert.equal(haus.primary_activity_type, 'experience')
  assert.ok(haus.secondary_activity_types.includes('cafe'))
})

test('기간형 Item은 Event/Venue 분리와 종료·재검수 기한을 가진다', () => {
  const expansionEvents = pool.items.filter((item) => item.source_key.startsWith('event-') && item.verified_at.startsWith('2026-09-01'))
  assert.ok(expansionEvents.length >= 6)
  assert.ok(expansionEvents.every((item) => item.item_kind === 'event' && item.valid_from && item.valid_until))
  assert.ok(expansionEvents.every((item) => Date.parse(item.availability_review_due_at) < Date.parse(item.valid_until)))
  assert.equal(pool.items.filter((item) => item.venue_source_key === 'venue-ilmin-museum').length, 2)
})

test('닫힌 성수 클라이밍 후보와 Family 파생 식별자는 import에 들어오지 않는다', () => {
  assert.ok(!pool.venues.some((venue) => venue.canonical_name === '클라이밍파크 성수점'))
  const sql = buildUpsertSql(pool)
  assert.doesNotMatch(sql, /family_place_id|derived_from_family_id/i)
  assert.doesNotMatch(sql, /\b(delete|truncate|drop)\b/i)
})

test('공개 Couple fixture dataset은 production 확장과 분리되어 있다', () => {
  assert.ok(coupleFixturePlaces.every((place) => place.datasetKind === 'fixture'))
  assert.notEqual(FIXTURE_DATASET_VERSION, pool.dataset_version)
})

test('1B-2A 26개 시나리오는 Human Gate assertion을 지킨다', () => {
  const report = runPhase1B2AQualityHarness()
  assert.equal(report.public_dataset_changed, false)
  assert.equal(report.scenarios.length, 26)
  assert.ok(Object.values(report.assertions).every(Boolean), JSON.stringify(report.assertions))
  assert.deepEqual(report.analysis.no_match_scenarios, ['S15', 'N01', 'N09'])
  assert.ok(report.analysis.primary_frequency[0].count <= 5)
  assert.equal(report.scenarios.find((scenario) => scenario.id === 'S03').primary.name, '제로월드 홍대점')
  assert.equal(report.scenarios.find((scenario) => scenario.id === 'S14').primary.name, '아라리오뮤지엄 인 스페이스')
  assert.equal(report.scenarios.find((scenario) => scenario.id === 'N08').primary.name, '피커스 종로점')
})

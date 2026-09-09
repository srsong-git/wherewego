import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  buildCoverageReport,
  buildUpsertSql,
  COUPLE_RECOMMENDATION_ITEM_DB_NOT_NULL_COLUMNS,
  COUPLE_VENUE_DB_NOT_NULL_COLUMNS,
  loadPhase1B2BPlacePool,
  validatePlacePool,
} from '../scripts/import-couple-place-pool.mjs'
import { runPhase1B2BQualityHarness } from '../scripts/run-couple-phase1b2b-quality.mjs'
import { FIXTURE_DATASET_VERSION } from '../supabase/functions/_shared/couple-fixtures.mjs'

const pool = loadPhase1B2BPlacePool()
const asOf = '2026-09-01T09:00:00.000Z'

test('Phase 1B-2B 로컬 pool은 132 Venue / 143 Item으로 검증된다', () => {
  const validation = validatePlacePool(pool)
  assert.deepEqual(validation.errors, [])
  assert.equal(pool.dataset_version, 'couple-production-phase1b2b-v1')
  assert.equal(pool.venues.length, 132)
  assert.equal(pool.items.length, 143)
  assert.equal(pool.phase1b2b_item_keys.length, 72)
  assert.ok(pool.items.every((item) => item.curation_origin === 'independent_couple_research'))
  assert.ok(pool.items.every((item) => !Object.hasOwn(item, 'family_place_id') && !Object.hasOwn(item, 'derived_from_family_id')))
})

test('DB NOT NULL 14/37 계약은 null, undefined, 빈 필수 문자열을 거부한다', () => {
  assert.equal(COUPLE_VENUE_DB_NOT_NULL_COLUMNS.length, 14)
  assert.equal(COUPLE_RECOMMENDATION_ITEM_DB_NOT_NULL_COLUMNS.length, 37)

  const generatedColumns = new Set(['id', 'created_at', 'updated_at'])
  const itemTarget = pool.items.find((item) => item.source_key === 'event-seoul-garden-expo-2026')
  const venueTarget = pool.venues.find((venue) => venue.source_key === itemTarget.venue_source_key)

  for (const column of COUPLE_RECOMMENDATION_ITEM_DB_NOT_NULL_COLUMNS) {
    if (generatedColumns.has(column)) continue
    for (const missingValue of [null, undefined]) {
      const invalid = structuredClone(pool)
      const item = invalid.items.find((entry) => entry.source_key === itemTarget.source_key)
      if (column === 'venue_id') item.venue_source_key = missingValue
      else if (column === 'dataset_kind' || column === 'dataset_version') invalid[column] = missingValue
      else item[column] = missingValue
      const validation = validatePlacePool(invalid)
      assert.equal(validation.ok, false, `Item ${column}=${missingValue}를 거부해야 합니다.`)
      assert.ok(validation.errors.some((error) => error.includes(column)), `Item ${column} 오류가 필요합니다.`)
    }
  }

  for (const column of COUPLE_VENUE_DB_NOT_NULL_COLUMNS) {
    if (generatedColumns.has(column)) continue
    for (const missingValue of [null, undefined]) {
      const invalid = structuredClone(pool)
      const venue = invalid.venues.find((entry) => entry.source_key === venueTarget.source_key)
      venue[column] = missingValue
      const validation = validatePlacePool(invalid)
      assert.equal(validation.ok, false, `Venue ${column}=${missingValue}를 거부해야 합니다.`)
      assert.ok(validation.errors.some((error) => error.includes(column)), `Venue ${column} 오류가 필요합니다.`)
    }
  }

  const requiredItemStrings = [
    'source_key', 'venue_id', 'item_kind', 'canonical_name', 'summary', 'category',
    'primary_activity_type', 'energy_level', 'novelty_level', 'freshness_class',
    'freshness_reason', 'freshness_verified_at', 'freshness_review_due_at',
    'price_band', 'price_basis', 'price_note', 'indoor_outdoor', 'walking_level',
    'wait_risk', 'status', 'verified_at', 'availability_status',
    'human_curation_status', 'dataset_kind', 'dataset_version',
  ]
  for (const column of requiredItemStrings) {
    const invalid = structuredClone(pool)
    const item = invalid.items.find((entry) => entry.source_key === itemTarget.source_key)
    if (column === 'venue_id') item.venue_source_key = '   '
    else if (column === 'dataset_kind' || column === 'dataset_version') invalid[column] = '   '
    else item[column] = '   '
    const validation = validatePlacePool(invalid)
    assert.equal(validation.ok, false, `Item ${column}의 공백 문자열을 거부해야 합니다.`)
    assert.ok(validation.errors.some((error) => error.includes(column)), `Item ${column} 공백 오류가 필요합니다.`)
  }

  for (const column of ['source_key', 'canonical_name', 'address', 'kakao_place_id', 'kakao_detail_url', 'meeting_area', 'status', 'verified_at']) {
    const invalid = structuredClone(pool)
    const venue = invalid.venues.find((entry) => entry.source_key === venueTarget.source_key)
    venue[column] = '   '
    const validation = validatePlacePool(invalid)
    assert.equal(validation.ok, false, `Venue ${column}의 공백 문자열을 거부해야 합니다.`)
    assert.ok(validation.errors.some((error) => error.includes(column)), `Venue ${column} 공백 오류가 필요합니다.`)
  }
})

test('검수된 6개 Event 가격 설명과 가격 근거를 보존한다', () => {
  const expected = new Map([
    ['event-seoul-garden-expo-2026', '무료 관람(일부 체험 유료)'],
    ['event-attack-on-titan-final-hongdae-2026', '성인 입장권 26,000원'],
    ['event-arko-art-of-learning-2026', '무료 관람'],
    ['event-culture-station-design-of-care-2026', '무료 관람'],
    ['event-sejong-hoban-art-prize-2026', '무료 관람'],
    ['event-kcdf-craft-design-competition-2026', '무료 관람'],
  ])

  for (const [sourceKey, priceNote] of expected) {
    const item = pool.items.find((entry) => entry.source_key === sourceKey)
    assert.equal(item.price_note, priceNote)
    assert.ok(item.source_references.some((reference) => reference.url.startsWith('https://')))
  }

  for (const missingPriceNote of [null, undefined, '', '   ']) {
    const invalid = structuredClone(pool)
    invalid.items.find((item) => item.source_key === 'event-seoul-garden-expo-2026').price_note = missingPriceNote
    const validation = validatePlacePool(invalid)
    assert.equal(validation.ok, false)
    assert.ok(validation.errors.some((error) => error.includes('price_note')))
  }
})

test('승인된 Human checkpoint 이후 추천 가능 40/41/39와 operational primary 12/15/13을 유지한다', () => {
  const report = buildCoverageReport(pool, asOf)
  assert.equal(report.totals.eligible_items, 120)
  assert.equal(report.totals.primary_eligible_items, 40)
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.areas).map(([area, value]) => [area, value.eligible_item_count])),
    { seongsu: 40, hongdae: 41, jongno_euljiro: 39 },
  )
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.areas).map(([area, value]) => [area, value.primary_item_count])),
    { seongsu: 12, hongdae: 15, jongno_euljiro: 13 },
  )
  assert.equal(report.quality_checks.phase1b2b_area_target_met, false)
  assert.ok(Object.values(report.areas).every((area) => area.gaps.length === 0))
})

test('신규 22/42/8과 전체 42/90/11 Human 상태가 정확하다', () => {
  const newItems = pool.items.filter((item) => pool.phase1b2b_item_keys.includes(item.source_key))
  const counts = (items) => Object.fromEntries(['keep_primary', 'alternative_only', 'research_hold'].map((status) => [
    status,
    items.filter((item) => item.human_curation_status === status).length,
  ]))
  assert.deepEqual(counts(newItems), { keep_primary: 22, alternative_only: 42, research_hold: 8 })
  assert.deepEqual(counts(pool.items), { keep_primary: 42, alternative_only: 90, research_hold: 11 })
  const holds = newItems.filter((item) => item.human_curation_status === 'research_hold')
  assert.ok(holds.every((item) => item.status === 'inactive' || item.availability_status !== 'unknown'))
  const report = buildCoverageReport(pool, asOf)
  assert.equal(report.totals.scheduled_items, 3)
  assert.ok(report.scheduled_item_keys.every((key) => !new Set(
    pool.items.filter((item) => item.status === 'active' && item.human_curation_status !== 'research_hold').map((item) => item.source_key),
  ).has(key) || Date.parse(pool.items.find((item) => item.source_key === key).valid_from) > Date.parse(asOf)))
})

test('생성 SQL은 독립 Couple additive upsert만 포함한다', () => {
  const sql = buildUpsertSql(pool)
  assert.match(sql, /couple-production-phase1b2b-v1/)
  assert.doesNotMatch(sql, /family_place_id|derived_from_family_id/i)
  assert.doesNotMatch(sql, /\b(delete|truncate|drop)\b/i)
})

test('S01~S15와 추가 시나리오가 Human Gate 및 품질 assertion을 지킨다', () => {
  const report = runPhase1B2BQualityHarness()
  assert.equal(report.totals.scenarios, 27)
  assert.ok(Object.values(report.assertions).every(Boolean), JSON.stringify(report.assertions))
  assert.deepEqual(report.quality.after.no_match, [])
  assert.equal(report.quality.checkpoint_before.average_lower_satisfaction, 90)
  assert.equal(report.quality.after.average_lower_satisfaction, 88.15)
  assert.ok(report.quality.after.average_lower_satisfaction > report.quality.phase1b2a_baseline.average_lower_satisfaction)
  assert.equal(report.quality.all.primary_frequency.find((entry) => entry.name === '1984'), undefined)
  assert.equal(report.base_scenarios.find((scenario) => scenario.id === 'S04').after.primary.activity_type, 'cafe')
  assert.equal(report.base_scenarios.find((scenario) => scenario.id === 'S14').after.primary.activity_type, 'cafe')
})

test('공개 Couple finalizer의 place source 기본값은 fixture로 유지된다', () => {
  const source = fs.readFileSync(new URL('../supabase/functions/finalize-decision-session/index.ts', import.meta.url), 'utf8')
  const catalogSource = fs.readFileSync(new URL('../supabase/functions/_shared/couple-catalog.mjs', import.meta.url), 'utf8')
  assert.ok(source.includes("Deno.env.get('COUPLE_PLACE_SOURCE')"))
  assert.ok(catalogSource.includes('return COUPLE_PLACE_SOURCES.fixture'))
  assert.ok(catalogSource.includes('getFixturePlaces(meetingArea)'))
  assert.ok(!source.includes('loadPhase1B2BPlacePool'))
  assert.notEqual(FIXTURE_DATASET_VERSION, pool.dataset_version)
})

test('1자 공식명은 허용하고 빈 이름은 막는 constraint가 seed보다 먼저 적용된다', () => {
  const migrationDir = new URL('../supabase/migrations/', import.meta.url)
  const migrations = fs.readdirSync(migrationDir).sort()
  const relaxName = migrations.find((name) => name.endsWith('_relax_couple_canonical_name_constraints.sql'))
  const seedName = migrations.find((name) => name.endsWith('_seed_couple_phase1b2b_pool.sql'))

  assert.equal(relaxName, '20260901124028_relax_couple_canonical_name_constraints.sql')
  assert.equal(seedName, '20260901124317_seed_couple_phase1b2b_pool.sql')
  assert.ok(migrations.indexOf(relaxName) < migrations.indexOf(seedName))
  assert.ok(!migrations.includes('20260901074514_seed_couple_phase1b2b_pool.sql'))

  const relaxSql = fs.readFileSync(new URL(relaxName, migrationDir), 'utf8')
  assert.match(relaxSql, /couple_venues_canonical_name_check[\s\S]*length\(btrim\(canonical_name\)\) >= 1[\s\S]*<= 120/)
  assert.match(relaxSql, /couple_recommendation_items_canonical_name_check[\s\S]*length\(btrim\(canonical_name\)\) >= 1[\s\S]*<= 160/)

  const generatedSql = fs.readFileSync(new URL('../reports/couple/phase1b2b-upsert.sql', import.meta.url), 'utf8')
  const seedSql = fs.readFileSync(new URL(seedName, migrationDir), 'utf8')
  assert.equal(seedSql, generatedSql)
  assert.doesNotMatch(seedSql, /\b(delete|truncate|drop)\b/i)

  assert.deepEqual(
    pool.venues.filter((venue) => [...venue.canonical_name.trim()].length === 1).map((venue) => venue.source_key),
    ['venue-teong'],
  )
  assert.deepEqual(
    pool.items.filter((item) => [...item.canonical_name.trim()].length === 1).map((item) => item.source_key),
    ['item-teong'],
  )
  assert.ok(pool.venues.every((venue) => venue.canonical_name.trim().length > 0))
  assert.ok(pool.items.every((item) => item.canonical_name.trim().length > 0))
  assert.match(seedSql, /https:\/\/www\.instagram\.com\/tung_seoul\//)
  assert.doesNotMatch(seedSql, /teong_seoul/)
})

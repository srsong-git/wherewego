import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  CatalogUnavailableError,
  PRODUCTION_DATASET_VERSION,
  loadCouplePlaces,
  loadProductionCatalogPlaces,
  prepareConsensusResultForPersistence,
  resolveCouplePlaceSource,
} from '../supabase/functions/_shared/couple-catalog.mjs'
import { calculateConsensus, CONSENSUS_ALGORITHM_VERSION } from '../supabase/functions/_shared/consensus.mjs'
import { FIXTURE_DATASET_VERSION } from '../supabase/functions/_shared/couple-fixtures.mjs'

const future = '2027-09-01T00:00:00.000Z'
const past = '2026-08-01T00:00:00.000Z'

function catalogRow(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    source_key: 'item-production-keep',
    canonical_name: '검수된 목적형 장소',
    summary: '두 사람이 함께 경험하고 대화할 수 있는 실제 운영 장소예요.',
    category: 'experience',
    energy_level: 'medium',
    effective_novelty_level: 'balanced',
    freshness_class: 'evergreen',
    freshness_expires_at: null,
    freshness_review_due_at: future,
    typical_spend_per_person: 18000,
    recommended_duration_minutes: 120,
    indoor_outdoor: 'indoor',
    walking_level: 'low',
    wait_risk: 'low',
    car_required: false,
    mobility_score: 3.5,
    status: 'active',
    valid_from: null,
    valid_until: null,
    verified_at: past,
    dataset_kind: 'production',
    dataset_version: PRODUCTION_DATASET_VERSION,
    venue_name: '검수된 목적형 장소',
    address: '서울 성동구 테스트로 1',
    latitude: 37.55,
    longitude: 127.04,
    kakao_place_id: '123456789',
    kakao_detail_url: 'https://place.map.kakao.com/123456789',
    meeting_area: 'seongsu',
    curation_origin: 'independent_couple_research',
    editorial_tier: 'hero',
    editorial_score: 85,
    editorial_rationale: '데이트 목적성과 함께 경험할 이유가 충분한 장소로 독립 검수했습니다.',
    editorial_reviewed_at: past,
    editorial_review_due_at: future,
    editorial_evidence_refs: ['https://example.com/official'],
    editorial_gate_version: 'couple-editorial-v1',
    booking_required: false,
    booking_url: null,
    booking_open_at: null,
    booking_close_at: null,
    availability_status: 'walk_in_only',
    availability_verified_at: past,
    availability_review_due_at: future,
    operational_eligible: true,
    editorial_eligible: true,
    recommendation_eligible: true,
    primary_recommendation_eligible: true,
    alternative_recommendation_eligible: true,
    primary_activity_type: 'experience',
    secondary_activity_types: ['walk_culture'],
    human_curation_status: 'keep_primary',
    human_curation_reviewed_at: past,
    human_curation_gate_version: 'couple-human-curation-v1',
    human_curation_eligible: true,
    ...overrides,
  }
}

function mockServiceClient(response) {
  const calls = { table: null, columns: null, filters: [], order: null }
  const query = {
    select(columns) { calls.columns = columns; return this },
    eq(column, value) { calls.filters.push([column, value]); return this },
    order(column, options) {
      calls.order = [column, options]
      return Promise.resolve(response)
    },
  }
  return {
    calls,
    from(table) { calls.table = table; return query },
  }
}

const relaxed = {
  activity: 'any',
  energy: 'medium',
  novelty: 'balanced',
  budget: 'any',
  duration: 'unlimited',
  vetoes: [],
}

test('COUPLE_PLACE_SOURCE 기본값은 fixture이고 기존 fixture dataset을 그대로 사용한다', async () => {
  assert.equal(resolveCouplePlaceSource(undefined), 'fixture')
  assert.equal(resolveCouplePlaceSource(''), 'fixture')
  const loaded = await loadCouplePlaces({ source: undefined, meetingArea: 'seongsu' })
  assert.equal(loaded.source, 'fixture')
  assert.equal(loaded.datasetVersion, FIXTURE_DATASET_VERSION)
  assert.equal(loaded.places.length, 4)
  assert.ok(loaded.places.every((place) => place.datasetKind === 'fixture'))

  const result = calculateConsensus({
    meetingArea: 'seongsu',
    answers: [relaxed, relaxed],
    places: loaded.places,
  })
  const persisted = prepareConsensusResultForPersistence(result, {
    datasetVersion: loaded.datasetVersion,
    algorithmVersion: CONSENSUS_ALGORITHM_VERSION,
  })
  assert.equal(persisted.status, 'ready')
  assert.equal(persisted.datasetVersion, FIXTURE_DATASET_VERSION)
  assert.ok(persisted.items.every((item) => item.placeId.startsWith('fixture-')))
  assert.ok(persisted.items.every((item) => item.recommendationItemId === null))
})

test('production source는 service-role 클라이언트로 server-only catalog view만 조회한다', async () => {
  const client = mockServiceClient({ data: [catalogRow()], error: null })
  const places = await loadProductionCatalogPlaces(client, 'seongsu')

  assert.equal(client.calls.table, 'couple_recommendation_catalog')
  assert.ok(client.calls.columns.includes('human_curation_status'))
  assert.deepEqual(client.calls.filters, [
    ['dataset_kind', 'production'],
    ['dataset_version', PRODUCTION_DATASET_VERSION],
    ['meeting_area', 'seongsu'],
    ['recommendation_eligible', true],
    ['alternative_recommendation_eligible', true],
  ])
  assert.equal(places[0].recommendationItemId, '11111111-1111-4111-8111-111111111111')
  assert.equal(places[0].humanCurationStatus, 'keep_primary')
})

test('alternative_only는 대안으로 남고 keep_primary만 강력추천 1위가 된다', async () => {
  const alternative = catalogRow({
    id: '22222222-2222-4222-8222-222222222222',
    source_key: 'aaa-alternative-only',
    canonical_name: '좋지만 대안인 장소',
    human_curation_status: 'alternative_only',
    primary_recommendation_eligible: false,
  })
  const keep = catalogRow({ source_key: 'zzz-keep-primary' })
  const client = mockServiceClient({ data: [alternative, keep], error: null })
  const places = await loadProductionCatalogPlaces(client, 'seongsu')
  const result = calculateConsensus({
    meetingArea: 'seongsu',
    answers: [relaxed, relaxed],
    places,
    now: new Date('2026-09-02T00:00:00.000Z'),
  })

  assert.equal(result.status, 'ready')
  assert.equal(result.items[0].placeId, 'zzz-keep-primary')
  assert.ok(result.items.slice(1).some((item) => item.placeId === 'aaa-alternative-only'))
})

test('research_hold가 catalog 응답에 섞이면 fail-closed로 추천 계산을 중단한다', async () => {
  const held = catalogRow({
    source_key: 'item-research-hold',
    human_curation_status: 'research_hold',
    human_curation_eligible: false,
    recommendation_eligible: false,
    alternative_recommendation_eligible: false,
    primary_recommendation_eligible: false,
  })
  const client = mockServiceClient({ data: [held], error: null })
  await assert.rejects(
    () => loadProductionCatalogPlaces(client, 'seongsu'),
    (error) => error instanceof CatalogUnavailableError && error.code === 'CATALOG_UNAVAILABLE',
  )
})

test('production catalog 조회 실패나 빈 결과는 fixture fallback 없이 CATALOG_UNAVAILABLE이다', async () => {
  for (const response of [
    { data: null, error: { message: 'catalog query failed' } },
    { data: [], error: null },
  ]) {
    const client = mockServiceClient(response)
    await assert.rejects(
      () => loadCouplePlaces({ source: 'production', meetingArea: 'seongsu', serviceClient: client }),
      (error) => error.code === 'CATALOG_UNAVAILABLE',
    )
  }
})

test('브라우저 place snapshot은 공개 allowlist만 남기고 내부 UUID와 Curation 메타데이터를 제거한다', async () => {
  const client = mockServiceClient({ data: [catalogRow()], error: null })
  const [place] = await loadProductionCatalogPlaces(client, 'seongsu')
  const result = calculateConsensus({
    meetingArea: 'seongsu',
    answers: [relaxed, relaxed],
    places: [place],
    now: new Date('2026-09-02T00:00:00.000Z'),
  })
  const persisted = prepareConsensusResultForPersistence(result, {
    datasetVersion: PRODUCTION_DATASET_VERSION,
    algorithmVersion: CONSENSUS_ALGORITHM_VERSION,
  })
  const item = persisted.items[0]

  assert.equal(item.recommendationItemId, place.recommendationItemId)
  assert.equal(item.place.name, place.name)
  assert.equal(item.place.kakaoPlaceUrl, place.kakaoPlaceUrl)
  for (const privateField of [
    'recommendationItemId', 'editorialScore', 'editorialTier', 'editorialRationale',
    'editorialEvidenceRefs', 'humanCurationStatus', 'humanCurationReviewedAt',
    'humanCurationGateVersion', 'curationOrigin', 'venueId',
  ]) {
    assert.equal(Object.hasOwn(item.place, privateField), false, privateField)
  }
})

test('결과 저장 migration은 production Item을 검증하고 browser catalog 권한을 열지 않는다', () => {
  const sql = fs.readFileSync(
    new URL('../supabase/migrations/20260902023327_persist_couple_catalog_result_metadata.sql', import.meta.url),
    'utf8',
  )
  assert.match(sql, /grant select on public\.couple_recommendation_catalog to service_role/i)
  assert.match(sql, /revoke all on public\.couple_recommendation_catalog[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /recommendation_item_id/i)
  assert.match(sql, /primary_recommendation_eligible/i)
  assert.match(sql, /INVALID_PUBLIC_PLACE_SNAPSHOT/i)
  assert.doesNotMatch(sql, /\b(delete|truncate)\b/i)
  assert.doesNotMatch(sql, /family_place|reviews|review_reports|withdrawal_requests/i)
})

test('finalizer는 source flag를 읽고 production 실패를 CATALOG_UNAVAILABLE로 반환한다', () => {
  const source = fs.readFileSync(
    new URL('../supabase/functions/finalize-decision-session/index.ts', import.meta.url),
    'utf8',
  )
  assert.match(source, /Deno\.env\.get\('COUPLE_PLACE_SOURCE'\)/)
  assert.match(source, /loadCouplePlaces/)
  assert.match(source, /CATALOG_UNAVAILABLE/)
  assert.doesNotMatch(source, /catch[\s\S]{0,300}getFixturePlaces/)
})

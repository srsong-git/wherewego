import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { calculateConsensus } from '../supabase/functions/_shared/consensus.mjs'
import {
  evaluateHumanCurationGate,
  evaluateRecommendationGates,
  isPrimaryRecommendationEligible,
} from '../supabase/functions/_shared/recommendation-gates.mjs'
import {
  buildConsensusPlaces,
  buildCoverageReport,
  loadPhase1B2APlacePool,
  validatePlacePool,
} from '../scripts/import-couple-place-pool.mjs'
import { runHumanCurationQualityHarness } from '../scripts/run-couple-human-curation-quality.mjs'

const pool = loadPhase1B2APlacePool()
const places = buildConsensusPlaces(pool)
const asOf = new Date('2026-09-01T03:00:00.000Z')
const relaxed = {
  activity: 'any',
  energy: 'medium',
  novelty: 'balanced',
  budget: 'any',
  duration: 'unlimited',
  vetoes: [],
}

test('승인된 49개 Human Review와 기존 대안 후보가 20/48/3 상태로 저장된다', () => {
  assert.deepEqual(validatePlacePool(pool).errors, [])
  const counts = Object.groupBy(pool.items, (item) => item.human_curation_status)
  assert.equal(counts.keep_primary.length, 20)
  assert.equal(counts.alternative_only.length, 48)
  assert.equal(counts.research_hold.length, 3)
  assert.ok(pool.items.every((item) => item.human_curation_gate_version === 'couple-human-curation-v1'))
})

test('Human Gate 이후 실제 추천 가능 58개와 primary 20개가 남는다', () => {
  const report = buildCoverageReport(pool, asOf)
  assert.equal(report.totals.eligible_items, 58)
  assert.equal(report.totals.primary_eligible_items, 20)
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.areas).map(([area, value]) => [area, value.eligible_item_count])),
    { seongsu: 20, hongdae: 19, jongno_euljiro: 19 },
  )
  assert.deepEqual(
    Object.fromEntries(Object.entries(report.areas).map(([area, value]) => [area, value.primary_item_count])),
    { seongsu: 5, hongdae: 9, jongno_euljiro: 6 },
  )
})

test('alternative_only는 대안으로 남지만 강력추천 자격은 없다', () => {
  const keep = places.find((place) => place.id === 'item-realworld-seongsu')
  const alternative = places.find((place) => place.id === 'item-oliveyoung-n-seongsu')
  assert.equal(evaluateRecommendationGates(alternative, asOf).alternativeEligible, true)
  assert.equal(isPrimaryRecommendationEligible(alternative), false)
  const result = calculateConsensus({
    meetingArea: 'seongsu',
    answers: [relaxed, relaxed],
    places: [alternative, keep],
    now: asOf,
  })
  assert.equal(result.status, 'ready')
  assert.equal(result.items[0].placeId, keep.id)
  assert.ok(result.items.slice(1).some((item) => item.placeId === alternative.id))
})

test('research_hold 3개는 primary와 alternative 모두에서 fail-closed 처리된다', () => {
  const held = places.filter((place) => place.humanCurationStatus === 'research_hold')
  assert.deepEqual(held.map((place) => place.name).sort((a, b) => a.localeCompare(b, 'ko')), [
    'STORY A 성수: 뷰티서바이벌 살인사건',
    'W락볼링센터',
    '서울레코드',
  ].sort((a, b) => a.localeCompare(b, 'ko')))
  held.forEach((place) => {
    assert.equal(evaluateHumanCurationGate(place).eligible, false)
    assert.equal(evaluateRecommendationGates(place, asOf).alternativeEligible, false)
  })
  const result = calculateConsensus({
    meetingArea: 'seongsu',
    answers: [relaxed, relaxed],
    places: held,
    now: asOf,
  })
  assert.equal(result.status, 'no_match')
})

test('Venue형 전시는 대안 전용이고 승인된 목적형 Venue는 primary를 유지한다', () => {
  for (const id of [
    'item-d-museum-visit',
    'item-kukje-gallery-k1',
    'item-gallery-hyundai',
    'item-seoul-craft-museum-permanent',
  ]) {
    assert.equal(places.find((place) => place.id === id).humanCurationStatus, 'alternative_only')
  }
  assert.equal(places.find((place) => place.id === 'item-mmca-seoul-visit').humanCurationStatus, 'keep_primary')
  assert.equal(places.find((place) => place.id === 'item-arario-museum-in-space-visit').humanCurationStatus, 'keep_primary')
})

test('S01~S15 Human Gate 품질 assertion이 모두 통과한다', () => {
  const report = runHumanCurationQualityHarness()
  assert.ok(Object.values(report.assertions).every(Boolean), JSON.stringify(report.assertions))
  assert.equal(report.after.research_hold_appearances, 0)
})

test('migration은 Couple Item에만 additive Human Gate를 적용한다', () => {
  const sql = fs.readFileSync(
    new URL('../supabase/migrations/20260901060820_add_couple_human_curation_gate.sql', import.meta.url),
    'utf8',
  )
  assert.match(sql, /add column if not exists human_curation_status/i)
  assert.match(sql, /human_curation_status = 'research_hold'/i)
  assert.doesNotMatch(sql, /\b(delete|truncate|drop)\b/i)
  assert.doesNotMatch(sql, /family_place|reviews|review_reports|withdrawal_requests/i)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCanaryChecks,
  canonicalRecommendationPayload,
  meaningfulResultsEqual,
  normalizeMeetingArea,
} from '../scripts/run-couple-canary-e2e.mjs'

function result(overrides = {}) {
  return {
    datasetVersion: 'couple-fixture-v1',
    algorithmVersion: 'consensus-weighted-v1',
    agreementScore: 85,
    sharedPoints: ['공통점'],
    differencePoints: ['차이점'],
    compromiseText: '절충 설명',
    items: [{
      rank: 1,
      role: 'activity',
      placeId: 'fixture-seongsu-cafe',
      score: 82.5,
      reason: '둘 다 편하게 머물기 좋아요.',
      place: { id: 'fixture-seongsu-cafe', name: 'Fixture 카페' },
    }],
    ...overrides,
  }
}

test('CLI jongno 별칭은 실제 DB 권역 코드로 정규화한다', () => {
  assert.equal(normalizeMeetingArea('jongno'), 'jongno_euljiro')
  assert.equal(normalizeMeetingArea('seongsu'), 'seongsu')
  assert.equal(normalizeMeetingArea('hongdae'), 'hongdae')
})

test('canonical payload는 객체 key 순서와 사용자별 비추천 필드를 무시한다', () => {
  const left = result({ participantSlot: 'A', receivedAt: '2026-09-02T00:00:00Z' })
  const right = {
    receivedAt: '2026-09-02T00:00:01Z',
    participantSlot: 'B',
    items: left.items,
    compromiseText: left.compromiseText,
    differencePoints: left.differencePoints,
    sharedPoints: left.sharedPoints,
    agreementScore: left.agreementScore,
    algorithmVersion: left.algorithmVersion,
    datasetVersion: left.datasetVersion,
  }

  assert.equal(meaningfulResultsEqual(left, right), true)
  assert.deepEqual(canonicalRecommendationPayload(left), canonicalRecommendationPayload(right))
})

test('canonical payload는 순위별 placeId, score, reason 차이를 각각 감지한다', () => {
  for (const changedItem of [
    { ...result().items[0], placeId: 'fixture-other', place: { id: 'fixture-other' } },
    { ...result().items[0], score: 80 },
    { ...result().items[0], reason: '다른 이유' },
  ]) {
    assert.equal(meaningfulResultsEqual(result(), result({ items: [changedItem] })), false)
  }
})

test('세부 검사는 key 순서 false negative 없이 모두 독립적으로 통과한다', () => {
  const a = result({ participantSlot: 'A' })
  const b = result({ participantSlot: 'B' })
  const restored = result({ refreshedAt: '2026-09-02T00:01:00Z' })
  const checks = buildCanaryChecks({
    finalizeData: { status: 'ready', finalized: true },
    finalizeError: null,
    stateA: { result: a },
    stateB: { result: b },
    restoreSessionError: null,
    restoreStateError: null,
    restoredState: { result: restored },
    expectedDatasetVersion: 'couple-fixture-v1',
  })

  assert.equal(Object.values(checks).every((check) => check.pass), true)
})

test('forbidden metadata, UUID, place identity 불일치는 별도 검사로 정확히 드러난다', () => {
  const exposed = result({
    items: [{
      ...result().items[0],
      placeId: 'fixture-public-id',
      place: {
        id: '11111111-1111-4111-8111-111111111111',
        editorialScore: 90,
      },
    }],
  })
  const checks = buildCanaryChecks({
    finalizeData: { status: 'ready', finalized: true },
    finalizeError: null,
    stateA: { result: exposed },
    stateB: { result: exposed },
    restoreSessionError: null,
    restoreStateError: null,
    restoredState: { result: exposed },
    expectedDatasetVersion: 'couple-fixture-v1',
  })

  assert.equal(checks.forbiddenMetadataExposure.pass, false)
  assert.equal(checks.publicUuidExposure.pass, false)
  assert.equal(checks.publicPlaceIdentity.pass, false)
  assert.deepEqual(checks.forbiddenMetadataExposure.actual.paths, ['result.items[0].place.editorialScore'])
  assert.deepEqual(checks.publicUuidExposure.actual.paths, ['result.items[0].place.id'])
})

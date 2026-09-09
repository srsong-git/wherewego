import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateConsensus } from '../supabase/functions/_shared/consensus.mjs'
import { coupleFixturePlaces, getFixturePlaces } from '../supabase/functions/_shared/couple-fixtures.mjs'
import { evaluateOperationalAvailabilityGate } from '../supabase/functions/_shared/recommendation-gates.mjs'
import { buildConsensusPlaces, loadPlacePool } from '../scripts/import-couple-place-pool.mjs'
import { expiredFixturePlace, inactiveFixturePlace } from './fixtures/couple-edge-fixtures.mjs'

const productionPlaces = buildConsensusPlaces(loadPlacePool())
const pilotNow = new Date('2026-08-31T12:00:00+09:00')

const relaxed = {
  activity: 'any',
  energy: 'medium',
  novelty: 'balanced',
  budget: 'any',
  duration: 'unlimited',
  vetoes: [],
}

test('A/B 순서를 바꿔도 합의 결과가 같다', () => {
  const a = { ...relaxed, activity: 'cafe', energy: 'low' }
  const b = { ...relaxed, activity: 'exhibition_popup', novelty: 'new' }
  const first = calculateConsensus({ meetingArea: 'seongsu', answers: [a, b], places: getFixturePlaces('seongsu') })
  const second = calculateConsensus({ meetingArea: 'seongsu', answers: [b, a], places: getFixturePlaces('seongsu') })
  assert.equal(first.agreementScore, second.agreementScore)
  assert.deepEqual(first.items.map((item) => item.placeId), second.items.map((item) => item.placeId))
})

test('어느 한 사람의 절대 제외도 후보가 위반하지 않는다', () => {
  const a = { ...relaxed, vetoes: ['outdoor', 'long_wait'] }
  const result = calculateConsensus({ meetingArea: 'seongsu', answers: [a, relaxed], places: getFixturePlaces('seongsu') })
  assert.equal(result.status, 'ready')
  result.items.forEach(({ place }) => {
    assert.notEqual(place.indoorOutdoor, 'outdoor')
    assert.notEqual(place.waitRisk, 'high')
  })
})

test('예산과 시간은 두 사람 중 더 엄격한 조건을 적용한다', () => {
  const strict = { ...relaxed, budget: 'under_20000', duration: '120' }
  const result = calculateConsensus({ meetingArea: 'hongdae', answers: [strict, relaxed], places: getFixturePlaces('hongdae') })
  result.items.forEach(({ place }) => {
    assert.ok(place.budgetPerPerson <= 20000)
    assert.ok(place.durationMinutes <= 120)
  })
})

test('이동 편의성은 최대 5점 보조 신호로만 작동한다', () => {
  const base = getFixturePlaces('seongsu')[1]
  const low = { ...base, id: 'mobility-low', mobilityScore: 0 }
  const excessive = { ...base, id: 'mobility-excessive', mobilityScore: 500 }
  const result = calculateConsensus({ meetingArea: 'seongsu', answers: [relaxed, relaxed], places: [low, excessive] })
  const scores = Object.fromEntries(result.items.map((item) => [item.placeId, item.score]))
  assert.ok(scores['mobility-excessive'] - scores['mobility-low'] <= 5)
})

test('이동 데이터가 없으면 중립값을 사용한다', () => {
  const base = getFixturePlaces('seongsu')[1]
  const missing = { ...base, id: 'mobility-missing', mobilityScore: undefined }
  const neutral = { ...base, id: 'mobility-neutral', mobilityScore: 2.5 }
  const result = calculateConsensus({ meetingArea: 'seongsu', answers: [relaxed, relaxed], places: [missing, neutral] })
  const scores = Object.fromEntries(result.items.map((item) => [item.placeId, item.score]))
  assert.equal(scores['mobility-missing'], scores['mobility-neutral'])
})

test('한 사람의 높은 평균보다 두 사람의 낮은 만족도를 먼저 끌어올린다', () => {
  const base = getFixturePlaces('seongsu')[1]
  const oneSided = {
    ...base,
    id: 'one-sided-cafe',
    category: 'cafe',
    activityType: 'cafe',
    energy: 'low',
    novelty: 'proven',
    mobilityScore: 2.5,
  }
  const balanced = {
    ...base,
    id: 'balanced-walk',
    category: 'walk',
    activityType: 'walk_culture',
    energy: 'medium',
    novelty: 'balanced',
    mobilityScore: 2.5,
  }
  const a = { ...relaxed, activity: 'cafe', energy: 'low', novelty: 'proven' }
  const b = { ...relaxed, activity: 'exhibition_popup', energy: 'high', novelty: 'new' }
  const result = calculateConsensus({ meetingArea: 'seongsu', answers: [a, b], places: [oneSided, balanced] })
  assert.equal(result.items[0].placeId, 'balanced-walk')
})

test('만료 장소는 추천하지 않는다', () => {
  const result = calculateConsensus({
    meetingArea: 'seongsu',
    answers: [relaxed, relaxed],
    places: [expiredFixturePlace],
    now: new Date('2026-08-30T00:00:00Z'),
  })
  assert.equal(result.status, 'no_match')
  assert.deepEqual(result.items, [])
})

test('모든 후보가 제외되면 조건을 완화하지 않고 no_match를 반환한다', () => {
  const impossible = { ...relaxed, vetoes: ['outdoor', 'cafe'] }
  const places = getFixturePlaces('jongno_euljiro').filter((place) => ['walk', 'cafe'].includes(place.category))
  const result = calculateConsensus({ meetingArea: 'jongno_euljiro', answers: [impossible, relaxed], places })
  assert.equal(result.status, 'no_match')
})

test('비활성 장소는 추천하지 않는다', () => {
  const result = calculateConsensus({ meetingArea: 'seongsu', answers: [relaxed, relaxed], places: [inactiveFixturePlace] })
  assert.equal(result.status, 'no_match')
})

test('비슷한 품질의 대안 사이에서는 다른 category를 우선한다', () => {
  const result = calculateConsensus({ meetingArea: 'jongno_euljiro', answers: [relaxed, relaxed], places: getFixturePlaces('jongno_euljiro') })
  assert.equal(result.status, 'ready')
  assert.notEqual(result.items[0].place.category, result.items[1].place.category)
})

test('category 다양성이 5점보다 높은 Consensus 품질 차이를 뒤집지 않는다', () => {
  const [base] = getFixturePlaces('seongsu')
  const primary = { ...base, id: 'a-primary', category: 'experience', activityType: 'experience' }
  const highQualitySameCategory = { ...base, id: 'b-high-same', category: 'experience', activityType: 'experience' }
  const lowQualityDifferentCategory = {
    ...base,
    id: 'low-different',
    category: 'walk',
    activityType: 'walk_culture',
    energy: 'high',
    novelty: 'new',
  }
  const answers = [{ ...relaxed, activity: 'experience', energy: 'low', novelty: 'proven' }, { ...relaxed, activity: 'experience', energy: 'low', novelty: 'proven' }]
  const result = calculateConsensus({ meetingArea: 'seongsu', answers, places: [primary, highQualitySameCategory, lowQualityDifferentCategory] })
  assert.equal(result.status, 'ready')
  assert.equal(result.items[1].placeId, 'b-high-same')
})

test('카페 veto는 primary cafe만 제외하고 secondary cafe 복합공간은 유지한다', () => {
  const [base] = getFixturePlaces('seongsu')
  const cafePrimary = {
    ...base,
    id: 'cafe-primary',
    category: 'culture',
    activityType: 'cafe',
    primaryActivityType: 'cafe',
    secondaryActivityTypes: ['walk_culture'],
  }
  const culturePrimary = {
    ...base,
    id: 'culture-primary',
    category: 'culture',
    activityType: 'walk_culture',
    primaryActivityType: 'walk_culture',
    secondaryActivityTypes: ['cafe'],
  }
  const answer = { ...relaxed, vetoes: ['cafe'] }
  const result = calculateConsensus({ meetingArea: 'seongsu', answers: [answer, relaxed], places: [cafePrimary, culturePrimary] })
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.items.map((item) => item.placeId), ['culture-primary'])
})

test('같은 입력과 버전은 항상 같은 결과를 만든다', () => {
  const inputs = { meetingArea: 'hongdae', answers: [relaxed, { ...relaxed, activity: 'experience' }], places: getFixturePlaces('hongdae') }
  const first = calculateConsensus(inputs)
  const second = calculateConsensus(inputs)
  assert.deepEqual(first, second)
})

test('활성 fixture는 운영 장소와 구분되며 권역별 네 곳이다', () => {
  assert.equal(coupleFixturePlaces.length, 12)
  for (const area of ['seongsu', 'hongdae', 'jongno_euljiro']) {
    const places = getFixturePlaces(area)
    assert.equal(places.length, 4)
    places.forEach((place) => {
      assert.equal(place.datasetKind, 'fixture')
      assert.equal(place.isFixture, true)
      assert.match(place.id, /^fixture-/)
    })
  }
})

test('production pilot의 대표 Preference 시나리오는 Editorial gate 이후 기존 Consensus로 계산된다', () => {
  for (const area of ['seongsu', 'hongdae', 'jongno_euljiro']) {
    const result = calculateConsensus({
      meetingArea: area,
      answers: [relaxed, { ...relaxed, activity: 'experience' }],
      places: productionPlaces,
      now: pilotNow,
    })
    assert.equal(result.status, 'ready')
    const primary = result.items[0].place
    assert.ok(primary.editorialTier === 'hero' || (primary.editorialTier === 'standard' && primary.editorialScore >= 70))
  }
})

test('Editorial score는 Preference Consensus 점수에 가중합되지 않는다', () => {
  const base = productionPlaces.find((place) => place.id === 'item-seoul-craft-museum-permanent')
  const lowerEditorial = { ...base, id: 'aaa-standard-70', name: '낮은 편집 점수', editorialTier: 'standard', editorialScore: 70 }
  const higherEditorial = { ...base, id: 'zzz-hero-95', name: '높은 편집 점수', editorialTier: 'hero', editorialScore: 95 }
  const result = calculateConsensus({
    meetingArea: base.meetingArea,
    answers: [relaxed, relaxed],
    places: [higherEditorial, lowerEditorial],
    now: pilotNow,
  })
  assert.equal(result.items[0].placeId, 'aaa-standard-70')
  assert.equal(result.items[0].score, result.items[1].score)
})

test('coverage 후보만 남으면 1위로 승격하지 않고 no_match를 반환한다', () => {
  const coverageOnly = productionPlaces.filter((place) => place.editorialTier === 'coverage')
  const result = calculateConsensus({
    meetingArea: 'hongdae',
    answers: [relaxed, relaxed],
    places: coverageOnly,
    now: pilotNow,
  })
  assert.equal(result.status, 'no_match')
  assert.deepEqual(result.items, [])
})

test('예약 필수 hero가 registration_closed이면 추천에서 제외된다', () => {
  const closedHero = productionPlaces.find((place) => place.id === 'event-semoca-najeon-box-2026')
  const result = calculateConsensus({
    meetingArea: 'jongno_euljiro',
    answers: [relaxed, relaxed],
    places: [closedHero],
    now: new Date('2026-09-10T12:00:00+09:00'),
  })
  assert.equal(closedHero.editorialTier, 'hero')
  assert.equal(closedHero.availabilityStatus, 'registration_closed')
  assert.equal(result.status, 'no_match')
})

test('sold_out과 Availability 검수 기한 초과는 fail-closed 처리된다', () => {
  const available = productionPlaces.find((place) => place.id === 'item-musinsa-megastore-seongsu')
  const soldOut = { ...available, bookingRequired: true, bookingUrl: 'https://example.com/book', availabilityStatus: 'sold_out' }
  const stale = { ...available, availabilityReviewDueAt: '2026-08-31T11:59:59+09:00' }
  assert.equal(evaluateOperationalAvailabilityGate(available, pilotNow).eligible, true)
  assert.equal(evaluateOperationalAvailabilityGate(soldOut, pilotNow).eligible, false)
  assert.equal(evaluateOperationalAvailabilityGate(stale, pilotNow).eligible, false)
})

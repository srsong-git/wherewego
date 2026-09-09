import crypto from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { places } from '../src/data/places.js'
import { refinePlaces, searchPlaces } from '../src/utils/placeFilters.js'

const ROOT = new URL('../', import.meta.url)
const batchPlaces = places.filter((place) => {
  const numericId = Number(place.id.slice(-3))
  return numericId >= 101 && numericId <= 150
})
const sourceReview = JSON.parse(fs.readFileSync(new URL('data/family/batch-01-source-review.json', ROOT), 'utf8'))
const kakaoAudit = JSON.parse(fs.readFileSync(new URL('data/family/batch-01-kakao-audit.json', ROOT), 'utf8'))
const kakaoPlaces = JSON.parse(fs.readFileSync(new URL('src/data/kakao-places.json', ROOT), 'utf8'))
const requiredFields = [
  'id', 'name', 'kakaoPlaceId', 'kakaoPlaceName', 'kakaoPlaceUrl', 'kakaoSearchKeyword',
  'area', 'address', 'region', 'subRegion', 'latitude', 'longitude', 'indoorOutdoor',
  'ageGroups', 'duration', 'priceCategory', 'description', 'themes', 'parentFatigueLevel',
  'parentFatigueReason', 'recommendFor', 'notRecommendFor',
]

function duplicates(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value)
}

test('Batch 1은 Family 런타임에 정확히 50곳을 추가한다', () => {
  assert.ok(places.length >= 150)
  assert.equal(batchPlaces.length, 50)
  assert.deepEqual(batchPlaces.map((place) => place.id), Array.from({ length: 50 }, (_, index) => `place-${index + 101}`))
  assert.deepEqual(
    Object.fromEntries(['성남', '용인', '수원', '화성'].map((area) => [area, batchPlaces.filter((place) => place.subRegion === area).length])),
    { 성남: 12, 용인: 18, 수원: 14, 화성: 6 },
  )
})

test('기존 Family 100곳의 ID·이름·Kakao ID는 변경되지 않았다', () => {
  const signature = crypto.createHash('sha256')
    .update(places.slice(0, 100).map((place) => `${place.id}|${place.name}|${place.kakaoPlaceId || ''}`).join('\n'))
    .digest('hex')
  assert.equal(signature, '462c50a5b3caba26ac60c0ae2d969c253a2e1b4951f5726aadce3b0d290b2f7c')
})

test('Family 전체의 id·name·kakaoPlaceId가 고유하다', () => {
  for (const field of ['id', 'name', 'kakaoPlaceId']) {
    assert.deepEqual(duplicates(places.map((place) => place[field])), [], `${field} 중복`)
  }
})

test('Batch 1의 필수 Family 필드와 Kakao 연결값이 모두 유효하다', () => {
  for (const place of batchPlaces) {
    for (const field of requiredFields) assert.ok(place[field] !== null && place[field] !== undefined && place[field] !== '', `${place.id} ${field}`)
    assert.match(place.kakaoPlaceUrl, new RegExp(`^https://place\\.map\\.kakao\\.com/${place.kakaoPlaceId}$`))
    assert.equal(place.kakaoVerified, true)
    assert.equal(place.kakaoNeedsReview, false)
    assert.equal(place.region, '경기')
    assert.ok(['성남', '용인', '수원', '화성'].includes(place.subRegion))
    assert.ok(Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
    assert.ok(['실내', '야외'].includes(place.indoorOutdoor))
    assert.ok(['1~2시간', '반나절', '하루'].includes(place.duration))
    assert.ok(['무료', '3만원 이하', '상관없음'].includes(place.priceCategory))
    assert.ok(['low', 'medium', 'high'].includes(place.parentFatigueLevel))
    assert.ok(place.ageGroups.length >= 2)
    assert.ok(place.themes.length >= 1)
    assert.ok(place.recommendFor.length >= 2 && place.notRecommendFor.length >= 2)

    const kakaoRecord = kakaoPlaces[place.name]
    assert.equal(String(kakaoRecord?.id), place.kakaoPlaceId)
    assert.equal(kakaoRecord?.url, place.kakaoPlaceUrl)
    assert.equal(kakaoRecord?.address, place.address, `${place.name}: Kakao 검증 주소`)
    assert.equal(kakaoRecord?.needsReview, false)
  }
})

test('공식 운영 근거와 Kakao 감사 결과가 50곳 모두 연결된다', () => {
  assert.equal(sourceReview.accepted.length, 50)
  assert.equal(sourceReview.duplicatesExcluded.length, 12)
  assert.equal(sourceReview.excluded.length, 7)
  assert.ok(sourceReview.excluded.every((entry) => entry.needsReview && entry.runtimeIncluded === false))
  assert.equal(kakaoAudit.total, 50)
  assert.equal(kakaoAudit.linked, 50)
  assert.equal(kakaoAudit.needsReview, 0)
  assert.equal(kakaoAudit.entries.length, 50)
  assert.deepEqual(duplicates(kakaoAudit.entries.map((entry) => entry.selectedKakaoPlaceId)), [])

  for (const entry of kakaoAudit.entries) {
    assert.ok(entry.officialSourceName)
    assert.match(entry.officialSourceUrl, /^https?:\/\//)
    assert.equal(entry.verifiedAt, '2026-09-09')
    assert.ok(entry.confidenceScore >= 76)
    assert.equal(entry.kakaoNeedsReview, false)
    assert.equal(entry.candidates[0]?.id, entry.selectedKakaoPlaceId)
  }
})

test('기존 Family 필터와 결과 정렬에 Batch 1 장소가 정상 참여한다', () => {
  const allResults = searchPlaces(batchPlaces, { weather: '', age: '', duration: '', price: '', themes: [] })
  assert.equal(allResults.length, 50)

  const indoorYoung = searchPlaces(batchPlaces, {
    weather: 'indoor',
    age: '유아',
    duration: '',
    price: '',
    themes: [],
  })
  assert.ok(indoorYoung.length >= 8)
  assert.ok(indoorYoung.every((place) => place.indoorOutdoor === '실내' && place.ageGroups.includes('유아')))

  const refined = refinePlaces(allResults, {
    region: '경기',
    themes: ['체험'],
    environment: '전체',
    sort: 'default',
    favoritesOnly: false,
  }, [], null)
  assert.ok(refined.length >= 20)
  assert.ok(refined.every(({ place }) => place.region === '경기' && place.themes.includes('체험')))

  const topThreeInputs = refined.slice(0, 3)
  assert.equal(topThreeInputs.length, 3)
  assert.deepEqual(duplicates(topThreeInputs.map(({ place }) => place.id)), [])
  assert.ok(topThreeInputs.every(({ place }) => place.parentFatigueLevel && place.description && place.ageGroups.length))
})

test('Batch 1의 실내외·테마 구성이 한 유형에 과도하게 치우치지 않는다', () => {
  const indoorCount = batchPlaces.filter((place) => place.indoorOutdoor === '실내').length
  const outdoorCount = batchPlaces.length - indoorCount
  assert.ok(indoorCount >= 15 && outdoorCount >= 15)

  const themeCounts = new Map()
  for (const place of batchPlaces) {
    for (const theme of place.themes) themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1)
  }
  assert.ok([...themeCounts.values()].every((count) => count / batchPlaces.length < 0.7))
})

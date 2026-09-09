import crypto from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { places } from '../src/data/places.js'
import { refinePlaces, searchPlaces } from '../src/utils/placeFilters.js'

const ROOT = new URL('../', import.meta.url)
const batchPlaces = places.filter((place) => {
  const numericId = Number(place.id.slice(-3))
  return numericId >= 201 && numericId <= 250
})
const sourceReview = JSON.parse(fs.readFileSync(new URL('data/family/batch-03-source-review.json', ROOT), 'utf8'))
const kakaoAudit = JSON.parse(fs.readFileSync(new URL('data/family/batch-03-kakao-audit.json', ROOT), 'utf8'))
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

test('Batch 3는 Family 런타임에 정확히 50곳을 추가한다', () => {
  assert.ok(places.length >= 250)
  assert.equal(batchPlaces.length, 50)
  assert.deepEqual(batchPlaces.map((place) => place.id), Array.from({ length: 50 }, (_, index) => `place-${index + 201}`))
  assert.equal(batchPlaces.filter((place) => ['천안', '아산'].includes(place.subRegion)).length, 20)
  assert.equal(batchPlaces.filter((place) => place.region === '강원').length, 20)
  assert.equal(batchPlaces.filter((place) => place.region === '부산').length, 10)
})

test('Batch 3 반영 전 Family 200곳의 핵심 식별값은 변경되지 않았다', () => {
  const signature = crypto.createHash('sha256')
    .update(places.slice(0, 200).map((place) => `${place.id}|${place.name}|${place.kakaoPlaceId || ''}`).join('\n'))
    .digest('hex')
  assert.equal(signature, 'd4659188c4fa26c729a0b2113d85e20a97a3979fb7b1a83116a77dced005b562')
})

test('Family 전체의 id·name·kakaoPlaceId가 고유하다', () => {
  for (const field of ['id', 'name', 'kakaoPlaceId']) {
    assert.deepEqual(duplicates(places.map((place) => place[field])), [], `${field} 중복`)
  }
})

test('Batch 3의 필수 Family 필드와 Kakao 연결값이 모두 유효하다', () => {
  for (const place of batchPlaces) {
    for (const field of requiredFields) assert.ok(place[field] !== null && place[field] !== undefined && place[field] !== '', `${place.id} ${field}`)
    assert.match(place.kakaoPlaceUrl, new RegExp(`^https://place\\.map\\.kakao\\.com/${place.kakaoPlaceId}$`))
    assert.equal(place.kakaoVerified, true)
    assert.equal(place.kakaoNeedsReview, false)
    assert.ok(['충청', '강원', '부산'].includes(place.region))
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
  assert.equal(sourceReview.duplicatesExcluded.length, 0)
  assert.equal(sourceReview.excluded.length, 3)
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

test('실내만 필터는 악천후에도 자연스러운 Batch 3 장소만 반환한다', () => {
  const indoorResults = searchPlaces(batchPlaces, {
    weather: 'indoor', age: '', duration: '', price: '', themes: [],
  })
  assert.equal(indoorResults.length, 30)
  assert.ok(indoorResults.every((place) => place.indoorOutdoor === '실내'))

  const outdoorDominantNames = [
    '태조산공원', '아름다운정원 화수목', '천안삼거리공원', '아산환경과학공원',
    '현충사', '외암민속마을', '피나클랜드 수목원', '곡교천 은행나무길', '아산레일바이크',
    '강원특별자치도립화목원', '국립춘천숲체원', '김유정문학촌', '레고랜드 코리아 리조트',
    '춘천 삼악산 호수케이블카', '뮤지엄산', '국립횡성숲체원', '강릉솔향수목원',
    '롯데월드 어드벤처 부산', '해운대수목원', '부산어린이대공원',
  ]
  assert.ok(outdoorDominantNames.every((name) => !indoorResults.some((place) => place.name === name)))
})

test('기존 Family 필터와 TOP 3 입력 흐름에 Batch 3 장소가 정상 참여한다', () => {
  const allResults = searchPlaces(batchPlaces, { weather: '', age: '', duration: '', price: '', themes: [] })
  const refined = refinePlaces(allResults, {
    region: '전체', themes: ['체험'], environment: '전체', sort: 'default', favoritesOnly: false,
  }, [], null)
  assert.ok(refined.length >= 15)
  assert.ok(refined.every(({ place }) => place.themes.includes('체험')))
  assert.equal(refined.slice(0, 3).length, 3)
  assert.deepEqual(duplicates(refined.slice(0, 3).map(({ place }) => place.id)), [])
})

test('Batch 3의 실내외·연령·지역 구성이 필터에서 유효하다', () => {
  assert.equal(batchPlaces.filter((place) => place.indoorOutdoor === '실내').length, 30)
  assert.equal(batchPlaces.filter((place) => place.indoorOutdoor === '야외').length, 20)
  assert.ok(batchPlaces.filter((place) => place.ageGroups.includes('유아')).length >= 30)
  assert.equal(batchPlaces.filter((place) => place.ageGroups.includes('초등 저학년')).length, 50)
  assert.ok(batchPlaces.filter((place) => place.ageGroups.includes('초등 고학년')).length >= 45)
  assert.deepEqual(new Set(batchPlaces.map((place) => place.region)), new Set(['충청', '강원', '부산']))
})

import crypto from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { places } from '../src/data/places.js'
import { refinePlaces, searchPlaces } from '../src/utils/placeFilters.js'

const ROOT = new URL('../', import.meta.url)
const batchPlaces = places.filter((place) => {
  const numericId = Number(place.id.slice(-3))
  return numericId >= 251 && numericId <= 295
})
const sourceReview = JSON.parse(fs.readFileSync(new URL('data/family/batch-04-source-review.json', ROOT), 'utf8'))
const kakaoAudit = JSON.parse(fs.readFileSync(new URL('data/family/batch-04-kakao-audit.json', ROOT), 'utf8'))
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

test('Batch 4는 Family 런타임에 정확히 45곳을 추가한다', () => {
  assert.equal(places.length, 295)
  assert.equal(batchPlaces.length, 45)
  assert.deepEqual(batchPlaces.map((place) => place.id), Array.from({ length: 45 }, (_, index) => `place-${index + 251}`))
  assert.equal(batchPlaces.filter((place) => place.region === '부산').length, 20)
  assert.equal(batchPlaces.filter((place) => place.region === '제주').length, 25)
})

test('Batch 4 반영 전 Family 250곳의 핵심 식별값은 변경되지 않았다', () => {
  const signature = crypto.createHash('sha256')
    .update(places.slice(0, 250).map((place) => `${place.id}|${place.name}|${place.kakaoPlaceId || ''}`).join('\n'))
    .digest('hex')
  assert.equal(signature, 'cb45b73549cd9b15c85912e911220f107de791f4d85bccfb8530e62d4ca4351b')
})

test('Family 전체의 id·name·kakaoPlaceId가 고유하다', () => {
  for (const field of ['id', 'name', 'kakaoPlaceId']) {
    assert.deepEqual(duplicates(places.map((place) => place[field])), [], `${field} 중복`)
  }
})

test('Batch 4의 필수 Family 필드와 Kakao 연결값이 모두 유효하다', () => {
  for (const place of batchPlaces) {
    for (const field of requiredFields) assert.ok(place[field] !== null && place[field] !== undefined && place[field] !== '', `${place.id} ${field}`)
    assert.match(place.kakaoPlaceUrl, new RegExp(`^https://place\\.map\\.kakao\\.com/${place.kakaoPlaceId}$`))
    assert.equal(place.kakaoVerified, true)
    assert.equal(place.kakaoNeedsReview, false)
    assert.ok(['부산', '제주'].includes(place.region))
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

test('공식 운영 근거와 Kakao 감사 결과가 45곳 모두 연결된다', () => {
  assert.equal(sourceReview.accepted.length, 45)
  assert.equal(sourceReview.duplicatesExcluded.length, 0)
  assert.equal(sourceReview.excluded.length, 3)
  assert.ok(sourceReview.excluded.every((entry) => entry.needsReview && entry.runtimeIncluded === false))
  assert.equal(kakaoAudit.total, 45)
  assert.equal(kakaoAudit.linked, 45)
  assert.equal(kakaoAudit.needsReview, 0)
  assert.equal(kakaoAudit.entries.length, 45)
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

test('실내만 필터는 악천후에도 자연스러운 Batch 4 장소만 반환한다', () => {
  const indoorResults = searchPlaces(batchPlaces, {
    weather: 'indoor', age: '', duration: '', price: '', themes: [],
  })
  assert.equal(indoorResults.length, 23)
  assert.ok(indoorResults.every((place) => place.indoorOutdoor === '실내'))

  const outdoorDominantNames = [
    '부산시민공원', '태종대유원지', '감천문화마을', '송도해상케이블카',
    '해운대블루라인파크 미포정거장', 'F1963', '부산화명수목원', '오륙도스카이워크',
    '제주 뽀로로앤타요 테마파크', '스누피가든', '신화테마파크', '제주레일바이크', '제주목 관아', '제주돌문화공원',
    '성산일출봉', '비자림', '한라수목원', '사려니숲길', '휴애리자연생활공원',
    '카멜리아힐', '아침미소목장', '에코랜드 테마파크',
  ]
  assert.ok(outdoorDominantNames.every((name) => !indoorResults.some((place) => place.name === name)))
})

test('기존 Family 필터와 TOP 3 입력 흐름에 Batch 4 장소가 정상 참여한다', () => {
  const allResults = searchPlaces(batchPlaces, { weather: '', age: '', duration: '', price: '', themes: [] })
  const refined = refinePlaces(allResults, {
    region: '전체', themes: ['자연·산책'], environment: '전체', sort: 'default', favoritesOnly: false,
  }, [], null)
  assert.ok(refined.length >= 15)
  assert.ok(refined.every(({ place }) => place.themes.includes('자연·산책')))
  assert.equal(refined.slice(0, 3).length, 3)
  assert.deepEqual(duplicates(refined.slice(0, 3).map(({ place }) => place.id)), [])
})

test('확장 지역이 Family 지역 필터에 노출되고 정상 필터링된다', () => {
  const appSource = fs.readFileSync(new URL('src/App.jsx', ROOT), 'utf8')
  for (const region of ['충청', '강원', '부산', '제주']) {
    assert.match(appSource, new RegExp(`'${region}'`))
    const refined = refinePlaces(places, {
      region, themes: [], environment: '전체', sort: 'default', favoritesOnly: false,
    }, [], null)
    assert.ok(refined.length > 0)
    assert.ok(refined.every(({ place }) => place.region === region))
  }
})

test('Batch 4의 실내외·연령·지역 구성이 필터에서 유효하다', () => {
  assert.equal(batchPlaces.filter((place) => place.indoorOutdoor === '실내').length, 23)
  assert.equal(batchPlaces.filter((place) => place.indoorOutdoor === '야외').length, 22)
  assert.ok(batchPlaces.filter((place) => place.ageGroups.includes('유아')).length >= 30)
  assert.equal(batchPlaces.filter((place) => place.ageGroups.includes('초등 저학년')).length, 45)
  assert.ok(batchPlaces.filter((place) => place.ageGroups.includes('초등 고학년')).length >= 40)
  assert.deepEqual(new Set(batchPlaces.map((place) => place.region)), new Set(['부산', '제주']))
})

import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { familyVisitInfoPilotIds } from '../src/data/family-place-content.js'
import { places } from '../src/data/places.js'
import { getProximityCandidatePool, refinePlaces, SEARCHED_ORIGIN_RADII_KM } from '../src/utils/placeFilters.js'
import { formatVerifiedAt, isVisitInfoStale, VISIT_INFO_STALE_DAYS } from '../src/utils/visitInfo.js'

const ROOT = new URL('../', import.meta.url)

test('방문 전 체크 파일럿은 지역별 6곳, 총 42곳이다', () => {
  assert.equal(familyVisitInfoPilotIds.length, 42)
  const pilotPlaces = places.filter((place) => place.visitInfo)
  assert.equal(pilotPlaces.length, 42)
  assert.deepEqual(
    Object.fromEntries(['서울', '경기', '인천', '충청', '강원', '부산', '제주'].map((region) => [region, pilotPlaces.filter((place) => place.region === region).length])),
    { 서울: 6, 경기: 6, 인천: 6, 충청: 6, 강원: 6, 부산: 6, 제주: 6 },
  )
})

test('파일럿 방문정보에는 공식 출처와 확인일이 있고 예약 미확인은 unknown이다', () => {
  const allowedStatuses = new Set(['required', 'recommended', 'not_required', 'partial', 'unknown'])
  for (const place of places.filter((item) => item.visitInfo)) {
    const info = place.visitInfo
    assert.ok(allowedStatuses.has(info.reservationStatus), `${place.name}: reservationStatus`)
    assert.match(info.officialInfoUrl, /^https?:\/\//, `${place.name}: officialInfoUrl`)
    assert.ok(info.officialSourceName, `${place.name}: officialSourceName`)
    assert.match(info.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${place.name}: verifiedAt`)
    if (info.reservationStatus === 'not_required') {
      assert.ok(info.reservationNote, `${place.name}: 예약 불필요 근거 문구`)
    }
  }
})

test('확인일 90일 초과 시에만 노후화 경고 조건이 참이다', () => {
  assert.equal(VISIT_INFO_STALE_DAYS, 90)
  assert.equal(isVisitInfoStale('2026-06-12', new Date('2026-09-10T00:00:00Z')), false)
  assert.equal(isVisitInfoStale('2026-06-11', new Date('2026-09-10T00:00:00Z')), true)
  assert.equal(isVisitInfoStale('invalid-date', new Date('2026-09-10T00:00:00Z')), true)
  assert.equal(formatVerifiedAt('2026-09-10'), '2026년 9월 10일 확인')
})

test('검색 위치 후보 pool은 15→30→60→120km 순으로 최소 3곳을 확보한다', () => {
  assert.deepEqual(SEARCHED_ORIGIN_RADII_KM, [15, 30, 60, 120])
  const items = [5, 10, 20, 29, 55, 110, 180].map((distance, index) => ({ place: { id: `p-${index}` }, distance }))
  const searchedOrigin = { type: 'searched', latitude: 0, longitude: 0, label: '테스트역' }
  assert.deepEqual(getProximityCandidatePool(items, searchedOrigin).map((item) => item.distance), [5, 10, 20, 29])
  assert.equal(getProximityCandidatePool(items, { ...searchedOrigin, type: 'current' }), items)
})

test('검색 위치에서는 일반 결과가 자동으로 가까운 순으로 정렬 가능하다', () => {
  const origin = { type: 'searched', label: '서울역', latitude: 37.5547, longitude: 126.9707 }
  const refined = refinePlaces(places.slice(0, 30), {
    region: '전체', themes: [], environment: '전체', sort: 'distance', favoritesOnly: false,
  }, [], origin)
  assert.ok(refined.every((item, index) => index === 0 || refined[index - 1].distance <= item.distance))
})

test('대표 이미지 audit는 재호스팅 권리가 없는 자료를 승인하지 않는다', () => {
  const audit = JSON.parse(fs.readFileSync(new URL('data/family/family-image-pilot-audit.json', ROOT), 'utf8'))
  assert.equal(audit.targetPlaceCount, 42)
  assert.equal(audit.accepted.length, 12)
  assert.ok(audit.accepted.every((entry) => entry.localHostingAllowed === true))
  assert.ok(audit.held.every((entry) => entry.localHostingAllowed === false))
  assert.ok(audit.requiredFields.includes('localHostingAllowed'))
  for (const entry of [...audit.accepted, ...audit.held]) {
    for (const field of audit.requiredFields) assert.notEqual(entry[field], undefined, `${entry.placeName}: ${field}`)
  }
  for (const entry of audit.accepted) {
    assert.match(entry.licenseUrl, /^https?:\/\//, `${entry.placeName}: licenseUrl`)
    assert.equal(fs.existsSync(new URL(entry.localPath, ROOT)), true, `${entry.placeName}: local image`)
  }

  const imageSource = fs.readFileSync(new URL('src/components/PlaceImage.jsx', ROOT), 'utf8')
  assert.match(imageSource, /place\.image\.sourceUrl/)
  assert.match(imageSource, /place\.image\.licenseUrl/)
  assert.match(imageSource, /onError=.*setLoadFailed/)
})

test('Family 위치 검색은 브라우저 저장소나 Supabase에 위치를 기록하지 않는다', () => {
  const appSource = fs.readFileSync(new URL('src/App.jsx', ROOT), 'utf8')
  const locationSource = fs.readFileSync(new URL('src/components/FamilyLocationSearch.jsx', ROOT), 'utf8')
  assert.doesNotMatch(locationSource, /localStorage|sessionStorage|supabase/i)
  assert.match(appSource, /useState\(null\)/)
  assert.doesNotMatch(appSource, /localStorage\.setItem\([^)]*(origin|location)/i)
})

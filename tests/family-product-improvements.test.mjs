import fs from 'node:fs'
import { createHash } from 'node:crypto'
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
  assert.equal(audit.targetPlaceCount, 40)
  assert.equal(audit.accepted.length, 19)
  assert.equal(audit.held.length, 21)
  assert.deepEqual(
    [audit.existingReview.keptCount, audit.existingReview.replacedCount, audit.existingReview.fallbackCount],
    [5, 1, 6],
  )
  assert.equal(places.filter((place) => place.image).length, 219)
  assert.ok(audit.accepted.every((entry) => entry.localHostingAllowed === true && entry.commercialUseAllowed === true && entry.derivativesAllowed === true))
  assert.ok(audit.held.every((entry) => entry.localHostingAllowed === false))
  assert.ok(audit.requiredAcceptedFields.includes('localHostingAllowed'))
  for (const entry of audit.accepted) {
    for (const field of audit.requiredAcceptedFields) assert.notEqual(entry[field], undefined, `${entry.placeName}: ${field}`)
  }
  for (const entry of audit.accepted) {
    assert.match(entry.licenseUrl, /^https?:\/\//, `${entry.placeName}: licenseUrl`)
    assert.equal(fs.existsSync(new URL(entry.localPath, ROOT)), true, `${entry.placeName}: local image`)
    const runtimePlace = places.find((place) => place.id === entry.placeId)
    assert.equal(runtimePlace?.image?.sourceUrl, entry.sourceUrl, `${entry.placeName}: runtime sourceUrl`)
    assert.equal(runtimePlace?.image?.localHostingAllowed, true, `${entry.placeName}: runtime localHostingAllowed`)
    assert.match(runtimePlace.image.sourceName, new RegExp(entry.exactLicense.replaceAll('.', '\\.')))
    assert.match(runtimePlace.image.sourceName, /crop·WebP 변환/)
    if (entry.shareAlikeRequired) assert.match(runtimePlace.image.licenseOrUsageBasis, /동일조건변경허락/)
    const imageFile = fs.readFileSync(new URL(entry.localPath, ROOT))
    assert.equal(imageFile.subarray(0, 4).toString('ascii'), 'RIFF', `${entry.placeName}: WebP RIFF header`)
    assert.equal(imageFile.subarray(8, 12).toString('ascii'), 'WEBP', `${entry.placeName}: WebP signature`)
  }

  const imageSource = fs.readFileSync(new URL('src/components/PlaceImage.jsx', ROOT), 'utf8')
  assert.match(imageSource, /place\.image\.sourceUrl/)
  assert.match(imageSource, /place\.image\.licenseUrl/)
  assert.match(imageSource, /onError=.*setLoadFailed/)
})

test('TourAPI 파일럿은 공공누리 제1유형 승인 이미지 15장만 로컬 반영한다', () => {
  const audit = JSON.parse(fs.readFileSync(new URL('data/family/family-tourapi-image-pilot-audit.json', ROOT), 'utf8'))
  const approved = audit.places.filter((entry) => entry.imageCandidate.status === 'approved')
  const review = audit.places.filter((entry) => entry.imageCandidate.status === 'review')

  assert.equal(audit.summary.appliedPlaceCount, 15)
  assert.equal(approved.length, 15)
  assert.equal(review.length, 5)
  assert.ok(approved.every((entry) => entry.imageCandidate.copyrightCode === 'Type1'))
  assert.ok(review.every((entry) => entry.imageCandidate.copyrightCode === 'Type3'))
  assert.ok(review.every((entry) => entry.imageCandidate.downloaded === false && entry.imageCandidate.uiApplied === false))

  for (const entry of approved) {
    const candidate = entry.imageCandidate
    for (const field of ['sourceName', 'sourceUrl', 'exactLicense', 'licenseOrUsageBasis', 'licenseUrl', 'attributionPlan', 'verifiedAt', 'imageType', 'imageVariant', 'representativenessAssessment', 'representativeReason', 'localPath']) {
      assert.notEqual(candidate[field], undefined, `${entry.familyPlaceName}: ${field}`)
      assert.notEqual(candidate[field], null, `${entry.familyPlaceName}: ${field}`)
    }
    assert.equal(candidate.downloaded, true, `${entry.familyPlaceName}: downloaded`)
    assert.equal(candidate.uiApplied, true, `${entry.familyPlaceName}: uiApplied`)
    assert.equal(candidate.outputDimensions.width, 940, `${entry.familyPlaceName}: width`)
    assert.equal(candidate.outputDimensions.height, 588, `${entry.familyPlaceName}: height`)
    assert.equal(fs.existsSync(new URL(candidate.localPath, ROOT)), true, `${entry.familyPlaceName}: local image`)

    const runtimePlace = places.find((place) => place.id === entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.placeId, entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.sourceUrl, candidate.sourceUrl)
    assert.equal(runtimePlace?.image?.tourApiContentId, entry.tourApiMatch.contentId)
    assert.equal(runtimePlace?.image?.imageVariant, candidate.imageType)
    assert.equal(runtimePlace?.image?.representativeReason, candidate.representativenessAssessment)
    assert.equal(runtimePlace?.image?.localHostingAllowed, true)
    assert.match(runtimePlace.image.licenseOrUsageBasis, /공공누리 제1유형/)

    const imageFile = fs.readFileSync(new URL(candidate.localPath, ROOT))
    assert.equal(imageFile.subarray(0, 4).toString('ascii'), 'RIFF', `${entry.familyPlaceName}: WebP RIFF header`)
    assert.equal(imageFile.subarray(8, 12).toString('ascii'), 'WEBP', `${entry.familyPlaceName}: WebP signature`)
  }
})

test('TourAPI 전체 audit의 자동 승인 91장만 기존 이미지를 덮어쓰지 않고 반영한다', () => {
  const sourceAudit = JSON.parse(fs.readFileSync(new URL('data/family/family-tourapi-fallback-audit.json', ROOT), 'utf8'))
  const applicationAudit = JSON.parse(fs.readFileSync(new URL('data/family/family-tourapi-approved-image-application.json', ROOT), 'utf8'))
  const approved = sourceAudit.places.filter((entry) => entry.decision === 'approved')
  const review = sourceAudit.places.filter((entry) => entry.decision === 'review')
  const applied = applicationAudit.entries.filter((entry) => entry.status === 'applied')

  assert.equal(places.length, 295)
  assert.equal(approved.length, 91)
  assert.equal(review.length, 109)
  assert.equal(applicationAudit.appliedCount, 91)
  assert.equal(applicationAudit.failedCount, 0)
  assert.equal(applicationAudit.existingImageCountBefore, 34)
  assert.equal(applicationAudit.existingImagesUnchanged, true)
  assert.equal(places.filter((place) => place.image).length, 219)
  assert.ok(approved.every((entry) => entry.licenseType === 'Type1'))
  assert.ok(approved.every((entry) => entry.tourApiMatchStatus === 'exact'))
  assert.ok(approved.every((entry) => entry.representativeQuality === 'high_by_tourapi_metadata'))

  for (const entry of applied) {
    for (const field of ['familyPlaceId', 'familyPlaceName', 'sourceName', 'tourApiContentId', 'sourceUrl', 'licenseOrUsageBasis', 'licenseType', 'licenseUrl', 'attributionText', 'verifiedAt', 'imageVariant', 'representativeReason', 'localPath']) {
      assert.notEqual(entry[field], undefined, `${entry.familyPlaceName}: ${field}`)
      assert.notEqual(entry[field], null, `${entry.familyPlaceName}: ${field}`)
    }
    assert.equal(entry.licenseType, 'Type1', `${entry.familyPlaceName}: licenseType`)
    assert.equal(entry.upscaled, false, `${entry.familyPlaceName}: no upscaling`)
    assert.equal(fs.existsSync(new URL(entry.localPath, ROOT)), true, `${entry.familyPlaceName}: local image`)

    const runtimePlace = places.find((place) => place.id === entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.placeId, entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.sourceUrl, entry.sourceUrl)
    assert.equal(runtimePlace?.image?.tourApiContentId, entry.tourApiContentId)
    assert.equal(runtimePlace?.image?.localHostingAllowed, true)
    assert.match(runtimePlace.image.licenseOrUsageBasis, /공공누리 제1유형/)

    const imageFile = fs.readFileSync(new URL(entry.localPath, ROOT))
    assert.equal(imageFile.subarray(0, 4).toString('ascii'), 'RIFF', `${entry.familyPlaceName}: WebP RIFF header`)
    assert.equal(imageFile.subarray(8, 12).toString('ascii'), 'WEBP', `${entry.familyPlaceName}: WebP signature`)
  }
})

test('사람 승인 제1유형 15장과 변경 없는 제3유형 PoC 10장만 추가 반영한다', () => {
  const audit = JSON.parse(fs.readFileSync(new URL('data/family/family-tourapi-human-review-type3-poc-application.json', ROOT), 'utf8'))
  const type1Entries = audit.entries.filter((entry) => entry.licenseType === 'Type1' && entry.status === 'applied')
  const type3Entries = audit.entries.filter((entry) => entry.licenseType === 'Type3' && entry.status === 'applied')

  assert.equal(audit.type1RequestedCount, 15)
  assert.equal(audit.type1AppliedCount, 15)
  assert.equal(audit.type3PocRequestedCount, 10)
  assert.equal(audit.type3PocAppliedCount, 10)
  assert.equal(audit.failedCount, 0)
  assert.equal(audit.existingImageCountBefore, 125)
  assert.equal(audit.existingImagesUnchanged, true)
  assert.equal(places.length, 295)
  assert.equal(places.filter((place) => place.image).length, 219)

  for (const entry of type1Entries) {
    const runtimePlace = places.find((place) => place.id === entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.tourApiContentId, entry.tourApiContentId)
    assert.match(runtimePlace?.image?.licenseOrUsageBasis, /공공누리 제1유형/)
    assert.equal(runtimePlace?.image?.preserveOriginal, undefined)
    assert.equal(entry.upscaled, false)
    assert.equal(fs.existsSync(new URL(entry.localPath, ROOT)), true)
  }

  for (const entry of type3Entries) {
    const runtimePlace = places.find((place) => place.id === entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.tourApiContentId, entry.tourApiContentId)
    assert.equal(runtimePlace?.image?.licenseType, 'Type3')
    assert.equal(runtimePlace?.image?.preserveOriginal, true)
    assert.equal(runtimePlace?.image?.transformation, 'none')
    assert.match(runtimePlace?.image?.licenseOrUsageBasis, /변경 및 2차적 저작물 작성 금지/)
    assert.equal(fs.existsSync(new URL(entry.localPath, ROOT)), true)
    assert.equal(entry.originalBytesPreserved, true)
    assert.equal(entry.transformation, 'none')
    assert.equal(entry.sha256, entry.downloadedSha256)
  }

  for (const placeId of ['place-021', 'place-119', 'place-164', 'place-267', 'place-293']) {
    assert.equal(places.find((place) => place.id === placeId)?.image, null, `${placeId}: 보류 이미지는 fallback 유지`)
  }

  const imageSource = fs.readFileSync(new URL('src/components/PlaceImage.jsx', ROOT), 'utf8')
  const cssSource = fs.readFileSync(new URL('src/styles.css', ROOT), 'utf8')
  assert.match(imageSource, /변경하지 않고 표시/)
  assert.match(imageSource, /place\.image\.sourcePolicyUrl/)
  assert.match(cssSource, /\.place-image\.no-derivatives img \{ object-fit: contain; \}/)
})

test('사람 검토를 통과한 제3유형 69장은 원본 그대로 추가하고 부적합한 4장은 fallback을 유지한다', () => {
  const audit = JSON.parse(fs.readFileSync(new URL('data/family/family-tourapi-type3-expansion-application.json', ROOT), 'utf8'))
  const applied = audit.decisions.filter((entry) => entry.decision === 'applied')
  const held = audit.decisions.filter((entry) => entry.decision === 'held')

  assert.equal(audit.targetCount, 73)
  assert.equal(audit.appliedCount, 69)
  assert.equal(audit.heldCount, 4)
  assert.equal(audit.alternateCandidateAppliedCount, 16)
  assert.equal(audit.existingImageCountBefore, 150)
  assert.equal(audit.existingImagesUnchanged, true)
  assert.equal(places.length, 295)
  assert.equal(places.filter((place) => place.image).length, 219)

  for (const entry of applied) {
    for (const field of ['familyPlaceId', 'familyPlaceName', 'sourceName', 'tourApiContentId', 'tourApiTitle', 'sourceUrl', 'sourcePolicyUrl', 'licenseOrUsageBasis', 'licenseUrl', 'attributionText', 'verifiedAt', 'imageVariant', 'representativeReason', 'localPath', 'sha256', 'downloadedSha256']) {
      assert.notEqual(entry[field], undefined, `${entry.familyPlaceName}: ${field}`)
      assert.notEqual(entry[field], null, `${entry.familyPlaceName}: ${field}`)
    }
    assert.equal(entry.licenseType, 'Type3')
    assert.equal(entry.originalBytesPreserved, true)
    assert.equal(entry.transformation, 'none')
    assert.equal(entry.sha256, entry.downloadedSha256)

    const file = fs.readFileSync(new URL(entry.localPath, ROOT))
    assert.equal(createHash('sha256').update(file).digest('hex'), entry.sha256)

    const runtimePlace = places.find((place) => place.id === entry.familyPlaceId)
    assert.equal(runtimePlace?.image?.sourceUrl, entry.sourceUrl)
    assert.equal(runtimePlace?.image?.tourApiContentId, entry.tourApiContentId)
    assert.equal(runtimePlace?.image?.licenseType, 'Type3')
    assert.equal(runtimePlace?.image?.preserveOriginal, true)
    assert.equal(runtimePlace?.image?.transformation, 'none')
    assert.equal(runtimePlace?.image?.originalSha256, entry.sha256)
  }

  assert.deepEqual(
    held.map((entry) => entry.familyPlaceId).sort(),
    ['place-052', 'place-072', 'place-076', 'place-149'],
  )
  for (const entry of held) {
    assert.ok(entry.reason)
    assert.equal(places.find((place) => place.id === entry.familyPlaceId)?.image, null)
  }

  const imageSource = fs.readFileSync(new URL('src/components/PlaceImage.jsx', ROOT), 'utf8')
  assert.match(imageSource, /공공누리 3유형/)
  assert.match(imageSource, /공공누리 1유형/)
  assert.match(imageSource, /한국관광공사 저작권 정책/)
})

test('Family 위치 검색은 브라우저 저장소나 Supabase에 위치를 기록하지 않는다', () => {
  const appSource = fs.readFileSync(new URL('src/App.jsx', ROOT), 'utf8')
  const locationSource = fs.readFileSync(new URL('src/components/FamilyLocationSearch.jsx', ROOT), 'utf8')
  assert.doesNotMatch(locationSource, /localStorage|sessionStorage|supabase/i)
  assert.match(appSource, /useState\(null\)/)
  assert.doesNotMatch(appSource, /localStorage\.setItem\([^)]*(origin|location)/i)
})

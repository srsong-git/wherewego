import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { places } from '../src/data/places.js'

const OUTPUT_PATH = 'data/family/family-tourapi-fallback-audit.json'
const PARTIAL_PATH = 'data/family/family-tourapi-fallback-audit.partial.json'
const API_BASE = 'https://apis.data.go.kr/B551011/KorService2'
const VERIFIED_AT = new Date().toISOString().slice(0, 10)
const REQUEST_DELAY_MS = 220
const BATCH_SIZE = 3
const MAX_RETRIES = 3
const EXPECTED_FAMILY_COUNT = 295
const EXPECTED_EXISTING_IMAGE_COUNT = 34
const EXPECTED_TARGET_COUNT = 261

const serviceKey = process.env.TOURAPI_SERVICE_KEY?.trim()

if (!serviceKey) {
  throw new Error('TOURAPI_SERVICE_KEY가 없습니다. node --env-file=.env.local scripts/audit-tourapi-family-images.mjs로 실행하세요.')
}

if (places.length !== EXPECTED_FAMILY_COUNT) {
  throw new Error(`Family 장소 수가 ${EXPECTED_FAMILY_COUNT}곳이 아닙니다: ${places.length}`)
}

const existingImagePlaces = places.filter((place) => place.image)
const targets = places.filter((place) => !place.image)

if (existingImagePlaces.length !== EXPECTED_EXISTING_IMAGE_COUNT || targets.length !== EXPECTED_TARGET_COUNT) {
  throw new Error(`이미지 범위 불일치: 기존 ${existingImagePlaces.length}, 조사 대상 ${targets.length}`)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const normalize = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/<[^>]*>/g, '')
  .replace(/[()[\]{}·ㆍ・:;,.'"!?~`’‘“”\-_\/\\&+]/g, '')
  .replace(/\s+/g, '')

const unique = (values) => [...new Set(values.filter(Boolean))]
const round = (value, digits = 3) => Number(Number(value).toFixed(digits))
const formatTourApiDate = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : null
}

const haversineKm = (latitude1, longitude1, latitude2, longitude2) => {
  if (![latitude1, longitude1, latitude2, longitude2].every(Number.isFinite)) return null
  const toRadians = (degrees) => degrees * Math.PI / 180
  const deltaLatitude = toRadians(latitude2 - latitude1)
  const deltaLongitude = toRadians(longitude2 - longitude1)
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const regionPatterns = {
  서울: ['서울특별시', '서울'],
  경기: ['경기도', '경기'],
  인천: ['인천광역시', '인천'],
  충청: ['충청남도', '충청북도', '세종특별자치시', '대전광역시', '충남', '충북', '세종', '대전'],
  강원: ['강원특별자치도', '강원도', '강원'],
  부산: ['부산광역시', '부산'],
  제주: ['제주특별자치도', '제주'],
}

const contentTypeLabels = {
  '12': '관광지',
  '14': '문화시설',
  '15': '축제·공연·행사',
  '25': '여행코스',
  '28': '레포츠',
  '32': '숙박',
  '38': '쇼핑',
  '39': '음식점',
}

const familyIdentityHash = () => crypto.createHash('sha256')
  .update(JSON.stringify(places.map(({ id, name, kakaoPlaceId }) => ({ id, name, kakaoPlaceId }))))
  .digest('hex')

const visitInfoHash = () => crypto.createHash('sha256')
  .update(JSON.stringify(places.map(({ id, visitInfo }) => ({ id, visitInfo: visitInfo ?? null }))))
  .digest('hex')

const existingImageHash = async () => {
  const hash = crypto.createHash('sha256')
  for (const place of [...existingImagePlaces].sort((left, right) => left.id.localeCompare(right.id))) {
    const relativePath = place.image.src.replace(/^\//, '')
    const filePath = path.join('public', relativePath.replace(/^place-images\//, 'place-images/'))
    hash.update(place.id)
    hash.update(await fs.readFile(filePath))
  }
  return hash.digest('hex')
}

const initialProtection = {
  familyIdentityHash: familyIdentityHash(),
  visitInfoHash: visitInfoHash(),
  existingImageHash: await existingImageHash(),
}

const extractItems = (payload) => {
  const items = payload?.response?.body?.items?.item
  if (!items) return []
  return Array.isArray(items) ? items : [items]
}

const encodedServiceKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey)

async function callTourApi(endpoint, parameters) {
  let lastError

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const query = new URLSearchParams({
        MobileOS: 'ETC',
        MobileApp: 'oneulwhere-family-image-audit',
        _type: 'json',
        ...parameters,
      })
      const response = await fetch(`${API_BASE}/${endpoint}?serviceKey=${encodedServiceKey}&${query}`)
      const payload = await response.json()
      const header = payload?.response?.header
      const serviceError = payload?.OpenAPI_ServiceResponse?.cmmMsgHeader

      if (!response.ok || header?.resultCode !== '0000') {
        const errorCode = header?.resultCode ?? serviceError?.returnReasonCode ?? response.status
        const errorMessage = header?.resultMsg ?? serviceError?.returnAuthMsg ?? 'TourAPI 오류'
        throw new Error(`${endpoint} ${errorCode}: ${errorMessage}`)
      }

      return extractItems(payload)
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES) await sleep(500 * (2 ** (attempt - 1)))
    }
  }

  throw lastError
}

const getAreaTokens = (place) => unique([
  ...String(place.area ?? '').split(/\s+/).slice(1),
  ...String(place.address ?? '').split(/\s+/).slice(1, 3),
])
  .map((token) => normalize(token.replace(/[특별광역자치도시군구읍면동리가로길]+$/g, '')))
  .filter((token) => token.length >= 2)

const nameVariants = (place) => unique([
  place.kakaoSearchKeyword,
  place.kakaoPlaceName,
  place.name,
]).map(normalize).filter((name) => name.length >= 2)

function contentTypeScore(place, contentTypeId) {
  const themes = new Set(place.themes ?? [])
  const cultural = ['역사·박물관', '과학', '미술·전시', '책·도서관'].some((theme) => themes.has(theme))
  const nature = ['자연·산책', '동물', '놀이'].some((theme) => themes.has(theme))
  const sports = themes.has('물놀이·스포츠')
  const shopping = themes.has('쇼핑')

  if (contentTypeId === '32') return -25
  if (contentTypeId === '39') return -15
  if (cultural && contentTypeId === '14') return 12
  if (cultural && contentTypeId === '12') return 4
  if (sports && contentTypeId === '28') return 12
  if (nature && contentTypeId === '12') return 12
  if (shopping && contentTypeId === '38') return 10
  if (contentTypeId === '15' || contentTypeId === '25') return -10
  return 0
}

function scoreCandidate(place, item) {
  const candidateTitle = normalize(item.title)
  const variants = nameVariants(place)
  const exactName = variants.some((name) => candidateTitle === name)
  const containedName = !exactName && variants.some((name) => name.length >= 4
    && (candidateTitle.includes(name) || name.includes(candidateTitle)))
  const candidateAddress = String(item.addr1 ?? '')
  const regionMatch = (regionPatterns[place.region] ?? [place.region]).some((region) => candidateAddress.includes(region))
  const areaTokens = getAreaTokens(place)
  const normalizedAddress = normalize(candidateAddress)
  const areaTokenMatches = areaTokens.filter((token) => normalizedAddress.includes(token))
  const latitude = Number(item.mapy)
  const longitude = Number(item.mapx)
  const distance = haversineKm(
    Number(place.latitude),
    Number(place.longitude),
    latitude,
    longitude,
  )
  const typeScore = contentTypeScore(place, String(item.contenttypeid ?? ''))

  let score = exactName ? 80 : containedName ? 48 : 0
  if (regionMatch) score += 20
  score += Math.min(areaTokenMatches.length, 2) * 6
  if (distance != null) {
    if (distance <= 0.25) score += 28
    else if (distance <= 1) score += 23
    else if (distance <= 3) score += 15
    else if (distance <= 10) score += 5
    else if (distance > 30) score -= 45
  }
  score += typeScore

  return {
    contentId: String(item.contentid ?? ''),
    contentTypeId: String(item.contenttypeid ?? ''),
    contentTypeLabel: contentTypeLabels[String(item.contenttypeid ?? '')] ?? '기타',
    title: String(item.title ?? '').replace(/<[^>]*>/g, ''),
    address: candidateAddress || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    distanceKm: distance == null ? null : round(distance),
    firstImage: item.firstimage || null,
    firstImage2: item.firstimage2 || null,
    copyrightCode: item.cpyrhtDivCd || null,
    createdAt: formatTourApiDate(item.createdtime),
    modifiedAt: formatTourApiDate(item.modifiedtime),
    exactName,
    containedName,
    regionMatch,
    areaTokenMatches,
    contentTypeScore: typeScore,
    score,
  }
}

const isExactMatch = (candidate) => Boolean(candidate) && (
  (candidate.exactName && candidate.regionMatch && (candidate.distanceKm == null || candidate.distanceKm <= 10) && candidate.score >= 105)
  || (candidate.exactName && candidate.distanceKm != null && candidate.distanceKm <= 2 && candidate.score >= 100)
  || (candidate.containedName && candidate.regionMatch && candidate.distanceKm != null && candidate.distanceKm <= 0.75 && candidate.score >= 90)
)

const isPlausibleMatch = (candidate) => Boolean(candidate) && (
  candidate.score >= 75
  || (candidate.exactName && candidate.distanceKm != null && candidate.distanceKm <= 20)
  || (candidate.containedName && candidate.regionMatch)
)

async function searchCandidates(place) {
  const primaryKeyword = place.kakaoSearchKeyword || place.kakaoPlaceName || place.name
  const queries = unique([primaryKeyword, place.kakaoPlaceName, place.name])
  const collected = new Map()
  let usedQueries = []

  for (const query of queries.slice(0, 2)) {
    const items = await callTourApi('searchKeyword2', {
      keyword: query,
      numOfRows: '10',
      pageNo: '1',
      arrange: 'A',
    })
    usedQueries.push(query)
    for (const item of items) collected.set(String(item.contentid), item)

    const ranked = [...collected.values()].map((item) => scoreCandidate(place, item)).sort((a, b) => b.score - a.score)
    if (isExactMatch(ranked[0])) return { ranked, usedQueries }
    await sleep(REQUEST_DELAY_MS)
  }

  if (!collected.size) {
    const localizedQuery = `${place.name} ${place.region}`
    const items = await callTourApi('searchKeyword2', {
      keyword: localizedQuery,
      numOfRows: '10',
      pageNo: '1',
      arrange: 'A',
    })
    usedQueries.push(localizedQuery)
    for (const item of items) collected.set(String(item.contentid), item)
  }

  return {
    ranked: [...collected.values()].map((item) => scoreCandidate(place, item)).sort((a, b) => b.score - a.score),
    usedQueries,
  }
}

const disallowedImageName = /포스터|축제|행사|공연|메뉴|음식|요리|기념품|상품|가격표|팸플릿|리플릿/i
const representativeImageName = /외관|전경|정문|입구|내부|실내|전시|체험|공원|정원|숲|바다|해변|동굴|박물관|과학관|수목원|아쿠아리움/i
const strongRepresentativeImageName = /외관|전경|정문|입구|내부|실내|전시|체험|공원|정원|숲|바다|해변|동굴/i

function rankImages(place, candidate, detailItems) {
  const first = candidate.firstImage ? [{
    contentId: candidate.contentId,
    imageName: `${candidate.title} 대표 이미지`,
    imageUrl: candidate.firstImage,
    thumbnailUrl: candidate.firstImage2,
    copyrightCode: candidate.copyrightCode,
    serialNumber: 'firstimage',
    imageVariant: 'searchKeyword2.firstimage',
  }] : []

  const details = detailItems.map((item) => ({
    contentId: String(item.contentid ?? candidate.contentId),
    imageName: String(item.imgname ?? ''),
    imageUrl: item.originimgurl || null,
    thumbnailUrl: item.smallimageurl || null,
    copyrightCode: item.cpyrhtDivCd || null,
    serialNumber: String(item.serialnum ?? ''),
    imageVariant: 'detailImage2',
  }))

  return [...first, ...details]
    .filter((image, index, images) => image.imageUrl
      && images.findIndex((candidateImage) => candidateImage.imageUrl === image.imageUrl) === index)
    .map((image) => {
      const normalizedImageName = normalize(image.imageName)
      const placeNames = nameVariants(place)
      const isFirstImage = image.imageVariant === 'searchKeyword2.firstimage'
      const titleRelevant = !isFirstImage
        && placeNames.some((name) => normalizedImageName.includes(name) || name.includes(normalizedImageName))
      const disallowed = disallowedImageName.test(image.imageName)
      const representativeHint = representativeImageName.test(image.imageName)
      const strongRepresentativeHint = strongRepresentativeImageName.test(image.imageName)
      let score = image.copyrightCode === 'Type1' ? 40 : image.copyrightCode === 'Type3' ? 5 : 0
      if (isFirstImage) score += 25
      if (titleRelevant) score += 18
      if (!isFirstImage && representativeHint) score += 10
      if (!isFirstImage && strongRepresentativeHint) score += 20
      if (disallowed) score -= 100
      return { ...image, titleRelevant, representativeHint, strongRepresentativeHint, disallowed, score }
    })
    .sort((left, right) => right.score - left.score)
}

function buildMatchReason(place, candidate, ambiguous) {
  if (!candidate) return 'TourAPI 검색 결과가 없습니다.'
  const signals = []
  if (candidate.exactName) signals.push('장소명 정확히 일치')
  else if (candidate.containedName) signals.push('장소명 포함 일치')
  if (candidate.regionMatch) signals.push('시·도 일치')
  if (candidate.areaTokenMatches.length) signals.push(`세부 지역 일치(${candidate.areaTokenMatches.join(', ')})`)
  if (candidate.distanceKm != null) signals.push(`좌표 차이 ${candidate.distanceKm}km`)
  signals.push(`콘텐츠 유형 ${candidate.contentTypeLabel}`)
  if (ambiguous) signals.push('유사 점수 후보가 있어 수동 확인 필요')
  return signals.join(' · ')
}

async function auditPlace(place) {
  try {
    const { ranked, usedQueries } = await searchCandidates(place)
    const best = ranked[0] ?? null
    const second = ranked[1] ?? null
    const ambiguous = Boolean(best && second
      && Math.abs(best.score - second.score) < 6
      && isPlausibleMatch(second)
      && best.contentId !== second.contentId)
    const exactMatch = isExactMatch(best) && !ambiguous
    const plausibleMatch = isPlausibleMatch(best)

    const base = {
      familyPlaceId: place.id,
      familyPlaceName: place.name,
      region: place.region,
      area: place.area,
      familyAddress: place.address,
      searchQueries: usedQueries,
      tourApiMatchStatus: exactMatch ? 'exact' : plausibleMatch ? 'review' : 'not_found',
      contentId: exactMatch ? best.contentId : null,
      tourApiTitle: exactMatch ? best.title : null,
      tourApiAddress: exactMatch ? best.address : null,
      tourApiContentTypeId: exactMatch ? best.contentTypeId : null,
      tourApiContentType: exactMatch ? best.contentTypeLabel : null,
      coordinateComparison: exactMatch ? {
        familyLatitude: Number(place.latitude),
        familyLongitude: Number(place.longitude),
        tourApiLatitude: best.latitude,
        tourApiLongitude: best.longitude,
        distanceKm: best.distanceKm,
      } : null,
      matchConfidenceScore: best?.score ?? 0,
      matchReason: buildMatchReason(place, best, ambiguous),
      topCandidates: ranked.slice(0, 3),
      tourApiCreatedAt: exactMatch ? best.createdAt : null,
      tourApiModifiedAt: exactMatch ? best.modifiedAt : null,
      imageCapturedAt: null,
      imageAvailable: false,
      selectedImageUrl: null,
      selectedImageVariant: null,
      licenseType: null,
      availableLicenseTypes: [],
      representativeQuality: 'none',
      decision: exactMatch ? 'rejected' : plausibleMatch ? 'review' : 'rejected',
      reason: exactMatch ? '정확한 장소는 확인했지만 이미지 조회 전입니다.' : plausibleMatch
        ? '동일 시설 가능성은 있으나 이름·주소·좌표 신호가 충분하지 않아 자동 연결하지 않았습니다.'
        : '동일 시설로 확정할 TourAPI 검색 결과를 찾지 못했습니다.',
    }

    if (!exactMatch) return base

    await sleep(REQUEST_DELAY_MS)
    const details = await callTourApi('detailImage2', {
      contentId: best.contentId,
      imageYN: 'Y',
      numOfRows: '100',
      pageNo: '1',
    })
    const rankedImages = rankImages(place, best, details)
    const selectedImage = rankedImages[0] ?? null
    const licenseTypes = unique(rankedImages.map((image) => image.copyrightCode || 'unknown'))

    base.imageAvailable = Boolean(selectedImage)
    base.availableLicenseTypes = licenseTypes
    base.imageCandidates = rankedImages.slice(0, 5)

    if (!selectedImage) {
      base.reason = '장소는 정확히 매칭됐지만 firstimage와 상세 이미지가 모두 없습니다.'
      return base
    }

    base.selectedImageUrl = selectedImage.imageUrl
    base.selectedImageVariant = selectedImage.imageVariant
    base.licenseType = selectedImage.copyrightCode || 'unknown'

    const automaticallyRepresentative = !selectedImage.disallowed && (
      selectedImage.imageVariant === 'searchKeyword2.firstimage'
      || (selectedImage.imageVariant === 'detailImage2'
        && selectedImage.titleRelevant
        && selectedImage.strongRepresentativeHint)
    )
    const safeContentType = !['15', '25', '32', '39'].includes(best.contentTypeId)
    base.representativeQuality = automaticallyRepresentative ? 'high_by_tourapi_metadata' : 'review_required'

    if (selectedImage.copyrightCode === 'Type1' && automaticallyRepresentative && safeContentType) {
      base.decision = 'approved'
      base.reason = selectedImage.imageVariant === 'searchKeyword2.firstimage'
        ? '정확한 시설 매칭이며 TourAPI 대표 이미지가 공공누리 제1유형입니다. 금지 키워드가 없어 자동 승인 조건을 충족합니다.'
        : '정확한 시설 매칭이며 장소명이 연결된 외관·전경·대표 공간 상세 이미지가 공공누리 제1유형이라 자동 승인 조건을 충족합니다.'
    } else if (selectedImage.copyrightCode === 'Type1') {
      base.decision = 'review'
      base.reason = !safeContentType
        ? `공공누리 제1유형이지만 TourAPI 콘텐츠 유형이 ${best.contentTypeLabel}이라 Family 장소 대표 이미지로 적절한지 사람 검토가 필요합니다.`
        : '공공누리 제1유형 후보이지만 메타데이터만으로 실제 대표성을 확정하기 어려워 사람 검토가 필요합니다.'
    } else if (selectedImage.copyrightCode === 'Type3') {
      base.decision = 'review'
      base.reason = '공공누리 제3유형은 변경금지이므로 crop·resize·WebP 변환을 전제로 자동 적용할 수 없습니다.'
    } else if (selectedImage.copyrightCode === 'Type2' || selectedImage.copyrightCode === 'Type4') {
      base.decision = 'rejected'
      base.reason = `${selectedImage.copyrightCode}은 상업적 이용 제한이 있어 자동 적용 대상에서 제외합니다.`
    } else {
      base.decision = 'review'
      base.reason = '이미지 권리 유형을 명확히 확인할 수 없어 자동 적용하지 않습니다.'
    }

    return base
  } catch (error) {
    return {
      familyPlaceId: place.id,
      familyPlaceName: place.name,
      region: place.region,
      area: place.area,
      familyAddress: place.address,
      searchQueries: [],
      tourApiMatchStatus: 'api_error',
      contentId: null,
      tourApiTitle: null,
      tourApiAddress: null,
      tourApiContentTypeId: null,
      tourApiContentType: null,
      coordinateComparison: null,
      matchConfidenceScore: 0,
      matchReason: 'TourAPI 요청 오류로 조사하지 못했습니다.',
      topCandidates: [],
      tourApiCreatedAt: null,
      tourApiModifiedAt: null,
      imageCapturedAt: null,
      imageAvailable: false,
      selectedImageUrl: null,
      selectedImageVariant: null,
      licenseType: null,
      availableLicenseTypes: [],
      representativeQuality: 'none',
      decision: 'review',
      reason: `API 오류: ${error.message}`,
    }
  }
}

function buildSummary(results) {
  const licenseCount = (license) => results.filter((place) => place.licenseType === license).length
  const summarizeRegion = (region) => {
    const regionResults = results.filter((place) => place.region === region)
    return {
      targetCount: regionResults.length,
      exactMatchCount: regionResults.filter((place) => place.tourApiMatchStatus === 'exact').length,
      matchFailedCount: regionResults.filter((place) => place.tourApiMatchStatus !== 'exact').length,
      imageAvailableCount: regionResults.filter((place) => place.imageAvailable).length,
      imageMissingCount: regionResults.filter((place) => !place.imageAvailable).length,
      type1Count: regionResults.filter((place) => place.licenseType === 'Type1').length,
      type3Count: regionResults.filter((place) => place.licenseType === 'Type3').length,
      otherOrUnknownLicenseCount: regionResults.filter((place) => place.imageAvailable && !['Type1', 'Type3'].includes(place.licenseType)).length,
      approvedCount: regionResults.filter((place) => place.decision === 'approved').length,
      reviewCount: regionResults.filter((place) => place.decision === 'review').length,
      rejectedCount: regionResults.filter((place) => place.decision === 'rejected').length,
    }
  }

  return {
    targetCount: results.length,
    exactMatchCount: results.filter((place) => place.tourApiMatchStatus === 'exact').length,
    matchFailedCount: results.filter((place) => place.tourApiMatchStatus !== 'exact').length,
    imageAvailableCount: results.filter((place) => place.imageAvailable).length,
    imageMissingCount: results.filter((place) => !place.imageAvailable).length,
    selectedLicenseCounts: {
      type1: licenseCount('Type1'),
      type3: licenseCount('Type3'),
      otherOrUnknown: results.filter((place) => place.imageAvailable && !['Type1', 'Type3'].includes(place.licenseType)).length,
    },
    availableLicensePlaceCounts: {
      type1: results.filter((place) => place.availableLicenseTypes.includes('Type1')).length,
      type3: results.filter((place) => place.availableLicenseTypes.includes('Type3')).length,
      otherOrUnknown: results.filter((place) => place.availableLicenseTypes.some((license) => !['Type1', 'Type3'].includes(license))).length,
    },
    approvedCount: results.filter((place) => place.decision === 'approved').length,
    reviewCount: results.filter((place) => place.decision === 'review').length,
    rejectedCount: results.filter((place) => place.decision === 'rejected').length,
    apiErrorCount: results.filter((place) => place.tourApiMatchStatus === 'api_error').length,
    regions: Object.fromEntries(['서울', '경기', '인천', '충청', '강원', '부산', '제주'].map((region) => [region, summarizeRegion(region)])),
  }
}

const results = []

for (let index = 0; index < targets.length; index += BATCH_SIZE) {
  const batch = targets.slice(index, index + BATCH_SIZE)
  const batchResults = await Promise.all(batch.map(auditPlace))
  results.push(...batchResults)

  if (results.length % 24 === 0 || results.length === targets.length) {
    const partial = {
      scope: 'Family fallback 261곳 TourAPI 대표 이미지 전체 조사',
      status: 'partial',
      verifiedAt: VERIFIED_AT,
      processedCount: results.length,
      targetCount: targets.length,
      summary: buildSummary(results),
      places: results,
    }
    await fs.writeFile(PARTIAL_PATH, `${JSON.stringify(partial, null, 2)}\n`, 'utf8')
    console.log(`progress ${results.length}/${targets.length} approved=${partial.summary.approvedCount} review=${partial.summary.reviewCount} rejected=${partial.summary.rejectedCount}`)
  }

  await sleep(REQUEST_DELAY_MS)
}

const finalProtection = {
  familyIdentityHash: familyIdentityHash(),
  visitInfoHash: visitInfoHash(),
  existingImageHash: await existingImageHash(),
}

const audit = {
  scope: 'Family fallback 261곳 TourAPI 대표 이미지 전체 조사',
  status: 'complete',
  verifiedAt: VERIFIED_AT,
  policy: {
    target: 'Family 295곳 중 승인된 로컬 이미지가 없는 261곳',
    match: '장소명, Kakao 연결명, 시·도, 세부 주소 토큰, 좌표 거리, TourAPI 콘텐츠 유형을 함께 비교하며 애매한 후보는 자동 연결하지 않습니다.',
    image: 'firstimage와 detailImage2 후보를 함께 비교하고 행사·포스터·음식 등 비대표 키워드를 감점합니다.',
    approval: '정확한 시설 매칭 + TourAPI firstimage + 공공누리 제1유형 + 비대표 금지 키워드 없음 조건을 모두 충족해야 자동 승인합니다.',
    recency: 'TourAPI 콘텐츠 생성·수정일은 기록하지만 사진 촬영일로 추정하지 않습니다. 촬영일을 제공하지 않으면 null로 유지합니다.',
    download: '이번 단계에서는 이미지 URL 메타데이터만 조사하며 이미지 파일 다운로드와 UI 반영을 하지 않습니다.',
  },
  api: {
    provider: '한국관광공사 TourAPI',
    service: 'KorService2',
    endpoints: ['searchKeyword2', 'detailImage2'],
    runtime: '로컬 Node.js --env-file=.env.local',
    concurrencyLimit: BATCH_SIZE,
    interBatchDelayMs: REQUEST_DELAY_MS,
    maxRetries: MAX_RETRIES,
    secretHandling: 'TOURAPI_SERVICE_KEY는 프로세스 환경에서만 읽고 audit·로그·브라우저 코드에 기록하지 않습니다.',
  },
  references: {
    tourApiSpecification: 'https://www.data.go.kr/data/15101578/openapi.do',
    ktoCopyrightPolicy: 'https://contest.visitkorea.or.kr/kor/helpDesk/copyrightGuide.kto',
    koglType1: 'https://www.kogl.or.kr/info/licenseType1.do',
    koglType3: 'https://www.kogl.or.kr/info/licenseType3.do',
  },
  protection: {
    familyPlaceCountBefore: EXPECTED_FAMILY_COUNT,
    familyPlaceCountAfter: places.length,
    existingImageCountBefore: EXPECTED_EXISTING_IMAGE_COUNT,
    existingImageCountAfter: places.filter((place) => place.image).length,
    familyIdentityUnchanged: initialProtection.familyIdentityHash === finalProtection.familyIdentityHash,
    visitInfoUnchanged: initialProtection.visitInfoHash === finalProtection.visitInfoHash,
    existingImagesUnchanged: initialProtection.existingImageHash === finalProtection.existingImageHash,
    imagesDownloaded: 0,
    uiChanges: 0,
  },
  summary: buildSummary(results),
  places: results,
}

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
await fs.rm(PARTIAL_PATH, { force: true })

console.log(JSON.stringify(audit.summary, null, 2))
console.log(`audit ${OUTPUT_PATH}`)

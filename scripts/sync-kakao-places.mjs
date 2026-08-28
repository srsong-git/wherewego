import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { kakaoPriorityReviewNames, places } from '../src/data/places.js'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GENERATED_DATA_PATH = path.join(ROOT_DIR, 'src', 'data', 'kakao-places.json')
const AUDIT_JSON_PATH = path.join(ROOT_DIR, 'kakao-place-audit.json')
const AUDIT_CSV_PATH = path.join(ROOT_DIR, 'kakao-place-audit.csv')
const API_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json'
const ACCEPT_SCORE = 76
const ACCEPT_MARGIN = 8
const priorityReviewSet = new Set(kakaoPriorityReviewNames)

function readEnvValue(name) {
  if (process.env[name]) return process.env[name].trim()

  const envPath = path.join(ROOT_DIR, '.env.local')
  if (!fs.existsSync(envPath)) return ''

  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`))

  if (!line) return ''
  const value = line.slice(line.indexOf('=') + 1).trim()
  return value.replace(/^(['"])(.*)\1$/, '$2')
}

function normalizeText(value) {
  return String(value || '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase()
}

function normalizePlaceUrl(id) {
  return id ? `https://place.map.kakao.com/${id}` : null
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function getCategoryHints(place) {
  const source = `${place.name} ${place.description} ${(place.themes || []).join(' ')}`
  const rules = [
    [/박물관|기념관|역사관|민속촌/, ['박물관', '기념관', '전시관', '문화시설']],
    [/과학관|과학|로보|우주|에너지/, ['과학관', '전시관', '체험관']],
    [/공원|숲|수목원|한강|호수|갯골|청계천|노들섬|화담숲/, ['공원', '도시근린공원', '자연명소', '수목원']],
    [/도서관|출판/, ['도서관', '문화시설']],
    [/미술|공예|디자인|아트|예술/, ['미술관', '전시관', '문화시설']],
    [/랜드|롯데월드|키자니아|플레이도시|상상나라|팜랜드|쁘띠프랑스/, ['테마파크', '놀이시설', '체험관']],
    [/아쿠아|생물|동물원|어린이대공원/, ['아쿠아리움', '동물원', '수족관']],
    [/궁$|행궁|화성|형무소/, ['문화유적', '고궁', '관광명소']],
    [/동굴/, ['동굴', '관광명소']],
    [/도자|김치|만화|애니메이션|모터스튜디오|모빌리티/, ['박물관', '체험관', '전시관']],
  ]

  return unique(rules.flatMap(([pattern, hints]) => (pattern.test(source) ? hints : [])))
}

function haversineDistance(place, candidate) {
  const latitude = Number(candidate.y)
  const longitude = Number(candidate.x)
  if (![place.latitude, place.longitude, latitude, longitude].every(Number.isFinite)) return Number.POSITIVE_INFINITY

  const toRadians = (value) => value * (Math.PI / 180)
  const latitudeDelta = toRadians(latitude - place.latitude)
  const longitudeDelta = toRadians(longitude - place.longitude)
  const latitude1 = toRadians(place.latitude)
  const latitude2 = toRadians(latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2

  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function scoreCandidate(place, candidate, query, currentEntry) {
  const candidateName = normalizeText(candidate.place_name)
  const targetNames = unique([query, place.kakaoSearchKeyword, place.kakaoPlaceName, place.name])
  const normalizedTargets = targetNames.map(normalizeText).filter(Boolean)
  const exactName = normalizedTargets.includes(candidateName)
  const containsName = normalizedTargets.some((target) => candidateName.includes(target))
  const containedByName = normalizedTargets.some((target) => target.includes(candidateName))
  const nameScore = exactName ? 52 : containsName ? 31 : containedByName ? 25 : 0

  const candidateAddress = normalizeText(`${candidate.road_address_name} ${candidate.address_name}`)
  const areaTokens = unique(`${place.address || ''} ${place.area || ''}`.split(/\s+/).map(normalizeText).filter((token) => token.length >= 2))
  const matchedAreaTokens = areaTokens.filter((token) => candidateAddress.includes(token))
  const addressScore = Math.min(12, matchedAreaTokens.length * 5)

  const apiDistance = Number(candidate.distance)
  const distance = Number.isFinite(apiDistance) && candidate.distance !== ''
    ? apiDistance
    : haversineDistance(place, candidate)
  const distanceScore = distance <= 100 ? 22
    : distance <= 300 ? 19
      : distance <= 800 ? 14
        : distance <= 1500 ? 8
          : distance <= 3000 ? 3
            : 0

  const categoryHints = getCategoryHints(place)
  const matchedCategory = categoryHints.find((hint) => candidate.category_name?.includes(hint)) || null
  const categoryScore = matchedCategory ? 14 : 0
  const existingIdScore = currentEntry?.id && String(currentEntry.id) === String(candidate.id) ? 35 : 0
  const score = Math.min(100, nameScore + addressScore + distanceScore + categoryScore + existingIdScore)

  return {
    ...candidate,
    score,
    exactName,
    distance: Number.isFinite(distance) ? Math.round(distance) : null,
    scoreReasons: [
      exactName ? '이름 정확히 일치' : containsName || containedByName ? '이름 부분 일치' : null,
      matchedAreaTokens.length ? `지역 ${matchedAreaTokens.join('·')} 일치` : null,
      Number.isFinite(distance) ? `기존 좌표에서 ${Math.round(distance)}m` : null,
      matchedCategory ? `카테고리 ${matchedCategory} 일치` : null,
      existingIdScore ? '기존 장소 ID 일치' : null,
    ].filter(Boolean),
  }
}

async function searchPlace(place, query, apiKey) {
  const params = new URLSearchParams({
    query,
    x: String(place.longitude),
    y: String(place.latitude),
    radius: '3000',
    sort: 'accuracy',
    size: '10',
  })
  const response = await fetch(`${API_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Kakao Local API 인증 실패 (${response.status}). KAKAO_REST_API_KEY를 확인해 주세요.`)
  }
  if (!response.ok) throw new Error(`Kakao Local API 요청 실패 (${response.status})`)

  const data = await response.json()
  return Array.isArray(data.documents) ? data.documents : []
}

function makeCandidateAudit(candidate) {
  return {
    place_name: candidate.place_name,
    id: String(candidate.id),
    place_url: normalizePlaceUrl(candidate.id),
    address_name: candidate.address_name || '',
    road_address_name: candidate.road_address_name || '',
    category_name: candidate.category_name || '',
    distance: candidate.distance,
    score: candidate.score,
  }
}

function makeCsv(auditEntries) {
  const headers = [
    'id', 'name', 'address', 'latitude', 'longitude', 'kakaoSearchKeyword',
    'selectedKakaoPlaceName', 'selectedKakaoPlaceId', 'selectedKakaoPlaceUrl',
    'confidenceScore', 'kakaoNeedsReview', 'reason',
  ]
  for (let index = 1; index <= 3; index += 1) {
    headers.push(
      `candidate${index}PlaceName`, `candidate${index}Id`, `candidate${index}PlaceUrl`,
      `candidate${index}AddressName`, `candidate${index}RoadAddressName`, `candidate${index}CategoryName`,
    )
  }

  const escapeCsv = (value) => {
    const text = value == null ? '' : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }

  const rows = auditEntries.map((entry) => {
    const base = [
      entry.id, entry.name, entry.address, entry.latitude, entry.longitude, entry.kakaoSearchKeyword,
      entry.selectedKakaoPlaceName, entry.selectedKakaoPlaceId, entry.selectedKakaoPlaceUrl,
      entry.confidenceScore, entry.kakaoNeedsReview, entry.reason,
    ]
    for (let index = 0; index < 3; index += 1) {
      const candidate = entry.candidates[index] || {}
      base.push(
        candidate.place_name, candidate.id, candidate.place_url,
        candidate.address_name, candidate.road_address_name, candidate.category_name,
      )
    }
    return base.map(escapeCsv).join(',')
  })

  return `\uFEFF${headers.map(escapeCsv).join(',')}\n${rows.join('\n')}\n`
}

function orderedEntries(records) {
  const ordered = {}
  for (const place of places) ordered[place.name] = records[place.name]
  for (const [name, record] of Object.entries(records)) {
    if (!(name in ordered)) ordered[name] = record
  }
  return ordered
}

async function main() {
  const apiKey = readEnvValue('KAKAO_REST_API_KEY')
  if (!apiKey) {
    throw new Error('KAKAO_REST_API_KEY가 없습니다. .env.local에 추가한 뒤 다시 실행해 주세요.')
  }

  const currentRecords = JSON.parse(fs.readFileSync(GENERATED_DATA_PATH, 'utf8'))
  const nextRecords = { ...currentRecords }
  const auditEntries = []

  for (const [index, place] of places.entries()) {
    const currentEntry = currentRecords[place.name] || {}
    const query = place.kakaoSearchKeyword || place.kakaoPlaceName || place.name
    process.stdout.write(`[${index + 1}/${places.length}] ${place.name} 검색 중... `)

    try {
      const documents = await searchPlace(place, query, apiKey)
      const ranked = documents
        .map((candidate) => scoreCandidate(place, candidate, query, currentEntry))
        .sort((left, right) => right.score - left.score || (left.distance ?? Infinity) - (right.distance ?? Infinity))
      const existingCandidate = currentEntry.id
        ? ranked.find((candidate) => String(candidate.id) === String(currentEntry.id))
        : null
      const bestCandidate = currentEntry.verified && currentEntry.id ? existingCandidate : ranked[0]
      const secondCandidate = ranked.find((candidate) => candidate.id !== bestCandidate?.id)
      const margin = bestCandidate ? bestCandidate.score - (secondCandidate?.score || 0) : 0
      const autoAccepted = Boolean(bestCandidate)
        && (Boolean(currentEntry.verified && currentEntry.id)
          || (bestCandidate.score >= ACCEPT_SCORE && (margin >= ACCEPT_MARGIN || bestCandidate.exactName)))

      let selectedEntry
      let reason
      if (currentEntry.verified && currentEntry.id) {
        selectedEntry = {
          ...currentEntry,
          address: existingCandidate?.road_address_name || existingCandidate?.address_name || currentEntry.address || null,
          needsReview: false,
        }
        reason = existingCandidate
          ? `기존 수동 검증 ID 유지 · ${existingCandidate.scoreReasons.join(' · ')}`
          : '기존 수동 검증 ID 유지 · 3km 검색 후보에는 나타나지 않음'
      } else if (autoAccepted) {
        selectedEntry = {
          id: String(bestCandidate.id),
          name: bestCandidate.place_name,
          url: normalizePlaceUrl(bestCandidate.id),
          searchKeyword: query,
          address: bestCandidate.road_address_name || bestCandidate.address_name || null,
          verified: false,
          needsReview: false,
        }
        reason = `자동 매칭 승인 · ${bestCandidate.scoreReasons.join(' · ')} · 2위와 ${margin}점 차이`
      } else {
        selectedEntry = {
          id: currentEntry.id || null,
          name: currentEntry.name || null,
          url: currentEntry.id ? normalizePlaceUrl(currentEntry.id) : null,
          searchKeyword: query,
          address: currentEntry.address || null,
          verified: Boolean(currentEntry.verified),
          needsReview: true,
        }
        reason = bestCandidate
          ? `자동 반영 보류 · 최고 ${bestCandidate.score}점, 2위와 ${margin}점 차이`
          : '자동 반영 보류 · 3km 내 검색 후보 없음'
      }

      nextRecords[place.name] = selectedEntry
      auditEntries.push({
        id: place.id,
        name: place.name,
        address: place.address || place.area || '',
        latitude: place.latitude,
        longitude: place.longitude,
        kakaoSearchKeyword: query,
        selectedKakaoPlaceName: selectedEntry.name,
        selectedKakaoPlaceId: selectedEntry.id,
        selectedKakaoPlaceUrl: selectedEntry.url,
        candidates: ranked.slice(0, 3).map(makeCandidateAudit),
        confidenceScore: bestCandidate?.score || 0,
        kakaoNeedsReview: selectedEntry.needsReview,
        priorityReview: priorityReviewSet.has(place.name),
        reason,
      })
      console.log(selectedEntry.needsReview ? '수동 확인 필요' : `연결 ${selectedEntry.id}`)
    } catch (error) {
      if (/인증 실패/.test(error.message)) throw error

      nextRecords[place.name] = {
        ...currentEntry,
        searchKeyword: query,
        needsReview: true,
      }
      auditEntries.push({
        id: place.id,
        name: place.name,
        address: place.address || place.area || '',
        latitude: place.latitude,
        longitude: place.longitude,
        kakaoSearchKeyword: query,
        selectedKakaoPlaceName: currentEntry.name || null,
        selectedKakaoPlaceId: currentEntry.id || null,
        selectedKakaoPlaceUrl: currentEntry.id ? normalizePlaceUrl(currentEntry.id) : null,
        candidates: [],
        confidenceScore: 0,
        kakaoNeedsReview: true,
        priorityReview: priorityReviewSet.has(place.name),
        reason: error.message,
      })
      console.log(`오류: ${error.message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 80))
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    source: API_URL,
    total: auditEntries.length,
    linked: auditEntries.filter((entry) => entry.selectedKakaoPlaceId).length,
    needsReview: auditEntries.filter((entry) => entry.kakaoNeedsReview).length,
    entries: auditEntries,
  }

  fs.writeFileSync(GENERATED_DATA_PATH, `${JSON.stringify(orderedEntries(nextRecords), null, 2)}\n`)
  fs.writeFileSync(AUDIT_JSON_PATH, `${JSON.stringify(audit, null, 2)}\n`)
  fs.writeFileSync(AUDIT_CSV_PATH, makeCsv(auditEntries))

  console.log(`\n완료: 연결 ${audit.linked}/${audit.total}, 수동 확인 ${audit.needsReview}`)
  console.log(`데이터: ${path.relative(ROOT_DIR, GENERATED_DATA_PATH)}`)
  console.log(`감사: ${path.relative(ROOT_DIR, AUDIT_JSON_PATH)}, ${path.relative(ROOT_DIR, AUDIT_CSV_PATH)}`)
}

main().catch((error) => {
  console.error(`동기화 실패: ${error.message}`)
  process.exitCode = 1
})

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { evaluateRecommendationGates } from '../supabase/functions/_shared/recommendation-gates.mjs'
import {
  phase1B2BEditorialReviews,
  phase1B2BExpansion,
  phase1B2BHumanCuration,
} from '../data/couple/phase1b2b/expansion.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_DATA_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b1', 'place-pool.json')
const DEFAULT_EDITORIAL_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b1', 'editorial-reviews.json')
const PHASE1B2A_DATA_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b2a', 'expansion.json')
const PHASE1B2A_EDITORIAL_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b2a', 'editorial-reviews.json')
const PHASE1B2A_HUMAN_CURATION_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b2a', 'human-curation.json')
const COUPLE_DATA_ROOT = path.join(ROOT_DIR, 'data', 'couple')
const REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b1-coverage.json')
const REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b1-coverage.md')
const UPSERT_SQL_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b1-upsert.sql')
const PHASE1B2A_REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-coverage.json')
const PHASE1B2A_REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-coverage.md')
const PHASE1B2A_UPSERT_SQL_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-upsert.sql')
const PHASE1B2B_REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2b-coverage.json')
const PHASE1B2B_REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2b-coverage.md')
const PHASE1B2B_UPSERT_SQL_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2b-upsert.sql')
const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json'

const MEETING_AREAS = ['seongsu', 'hongdae', 'jongno_euljiro']
const ACTIVITY_TRAITS = ['cafe', 'exhibition_popup', 'experience', 'walk_culture']
const ENERGY_LEVELS = ['low', 'medium', 'high']
const NOVELTY_LEVELS = ['proven', 'balanced', 'new']
const PRICE_BANDS = ['free', 'under_20000', 'under_40000', 'over_40000', 'variable']
const EDITORIAL_TIERS = ['hero', 'standard', 'coverage', 'reject']
const AVAILABILITY_STATUSES = ['available', 'limited', 'sold_out', 'registration_closed', 'walk_in_only', 'unknown']
const HUMAN_CURATION_STATUSES = ['keep_primary', 'alternative_only', 'research_hold']
const FORBIDDEN_FAMILY_FIELDS = new Set(['family_place_id', 'derived_from_family_id'])
const GENERIC_NAME_PATTERNS = [
  /조용한\s*카페/i,
  /작은\s*전시/i,
  /신상\s*전시/i,
  /활동적인\s*체험/i,
  /generic/i,
  /fixture/i,
]
const IMAGE_FIELD_PATTERN = /(^|_)(image|photo|thumbnail|media)(_|$)/i

export const COUPLE_VENUE_DB_NOT_NULL_COLUMNS = Object.freeze([
  'id',
  'source_key',
  'canonical_name',
  'address',
  'latitude',
  'longitude',
  'kakao_place_id',
  'kakao_detail_url',
  'meeting_area',
  'status',
  'verified_at',
  'source_references',
  'created_at',
  'updated_at',
])

export const COUPLE_RECOMMENDATION_ITEM_DB_NOT_NULL_COLUMNS = Object.freeze([
  'id',
  'source_key',
  'venue_id',
  'item_kind',
  'canonical_name',
  'summary',
  'category',
  'activity_traits',
  'primary_activity_type',
  'secondary_activity_types',
  'energy_level',
  'novelty_level',
  'freshness_class',
  'freshness_reason',
  'freshness_verified_at',
  'freshness_review_due_at',
  'price_band',
  'typical_spend_per_person',
  'required_spend_per_person',
  'price_basis',
  'price_note',
  'recommended_duration_minutes',
  'indoor_outdoor',
  'walking_level',
  'wait_risk',
  'car_required',
  'status',
  'verified_at',
  'source_references',
  'editorial_evidence_refs',
  'booking_required',
  'availability_status',
  'human_curation_status',
  'dataset_kind',
  'dataset_version',
  'created_at',
  'updated_at',
])

const DB_OR_PIPELINE_GENERATED_NOT_NULL_COLUMNS = new Set(['id', 'created_at', 'updated_at'])
const VENUE_REQUIRED_STRING_COLUMNS = new Set([
  'source_key', 'canonical_name', 'address', 'kakao_place_id', 'kakao_detail_url',
  'meeting_area', 'status', 'verified_at',
])
const ITEM_REQUIRED_STRING_COLUMNS = new Set([
  'source_key', 'venue_id', 'item_kind', 'canonical_name', 'summary', 'category',
  'primary_activity_type', 'energy_level', 'novelty_level', 'freshness_class',
  'freshness_reason', 'freshness_verified_at', 'freshness_review_due_at',
  'price_band', 'price_basis', 'price_note', 'indoor_outdoor', 'walking_level',
  'wait_risk', 'status', 'verified_at', 'availability_status',
  'human_curation_status', 'dataset_kind', 'dataset_version',
])
const GENERATED_NOT_NULL_VALUE = Symbol('generated-not-null-value')

function readEnvValue(name) {
  if (process.env[name]) return process.env[name].trim()
  const envPath = path.join(ROOT_DIR, '.env.local')
  if (!fs.existsSync(envPath)) return ''
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`))
  if (!line) return ''
  return line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function countBy(values, allowedValues) {
  return Object.fromEntries(allowedValues.map((value) => [value, values.filter((entry) => entry === value).length]))
}

function pushError(errors, condition, message) {
  if (!condition) errors.push(message)
}

function resolveDbNotNullValue(pool, record, column, recordKind) {
  if (DB_OR_PIPELINE_GENERATED_NOT_NULL_COLUMNS.has(column)) return GENERATED_NOT_NULL_VALUE
  if (recordKind === 'item' && column === 'venue_id') return record.venue_source_key
  if (recordKind === 'item' && column === 'dataset_kind') return pool.dataset_kind
  if (recordKind === 'item' && column === 'dataset_version') return pool.dataset_version
  if (
    recordKind === 'item'
    && column === 'human_curation_status'
    && record.human_curation_status == null
    && pool.human_curation_gate_version == null
  ) return 'research_hold'
  return record[column]
}

function validateDbNotNullContract(errors, { pool, record, columns, stringColumns, label, recordKind }) {
  for (const column of columns) {
    const value = resolveDbNotNullValue(pool, record, column, recordKind)
    pushError(errors, value !== null && value !== undefined, `${label}.${column}은 DB NOT NULL 필수값입니다.`)
    if (stringColumns.has(column) && value !== null && value !== undefined) {
      pushError(
        errors,
        typeof value === 'string' && value.trim().length > 0,
        `${label}.${column}은 비어 있지 않은 DB NOT NULL 문자열이어야 합니다.`,
      )
    }
  }
}

function findImageFields(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((entry, index) => findImageFields(entry, `${prefix}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, entry]) => {
    const fieldPath = prefix ? `${prefix}.${key}` : key
    return [
      ...(IMAGE_FIELD_PATTERN.test(key) ? [fieldPath] : []),
      ...findImageFields(entry, fieldPath),
    ]
  })
}

function findForbiddenFamilyFields(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((entry, index) => findForbiddenFamilyFields(entry, `${prefix}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, entry]) => {
    const fieldPath = prefix ? `${prefix}.${key}` : key
    return [
      ...(FORBIDDEN_FAMILY_FIELDS.has(key) ? [fieldPath] : []),
      ...findForbiddenFamilyFields(entry, fieldPath),
    ]
  })
}

function assertCoupleImportPath(value, label) {
  const resolved = path.resolve(value)
  const relative = path.relative(COUPLE_DATA_ROOT, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).includes('family')) {
    throw new Error(`${label}는 data/couple 아래의 독립 Couple 데이터만 사용할 수 있습니다.`)
  }
  return resolved
}

function calculateEditorialScore(item) {
  return item.couple_relevance * 6
    + item.destination_appeal * 4
    + item.current_appeal * 4
    + item.distinctiveness * 3
    + item.conversation_or_experience_value * 3
    - (item.repeat_commonness_risk - 1) * 5
}

function mergeEditorialReview(item, review, editorialFile) {
  const [
    coupleRelevance,
    destinationAppeal,
    currentAppeal,
    distinctiveness,
    conversationValue,
    commonnessRisk,
  ] = review.scores || []
  const isRejected = review.editorial_tier === 'reject'
  return {
    ...item,
    status: isRejected ? 'inactive' : item.status,
    couple_relevance: coupleRelevance,
    destination_appeal: destinationAppeal,
    current_appeal: currentAppeal,
    distinctiveness,
    conversation_or_experience_value: conversationValue,
    repeat_commonness_risk: commonnessRisk,
    editorial_score: review.editorial_score,
    editorial_tier: review.editorial_tier,
    editorial_rationale: review.editorial_rationale,
    editorial_reviewed_at: editorialFile.editorial_reviewed_at,
    editorial_review_due_at: review.editorial_review_due_at,
    editorial_evidence_refs: review.editorial_evidence_refs || item.source_references,
    editorial_gate_version: editorialFile.editorial_gate_version,
    curation_origin: editorialFile.curation_origin,
    booking_required: review.booking_required ?? false,
    booking_url: review.booking_url ?? null,
    booking_open_at: review.booking_open_at ?? null,
    booking_close_at: review.booking_close_at ?? null,
    availability_status: review.availability_status,
    availability_verified_at: editorialFile.availability_verified_at,
    availability_review_due_at: review.availability_review_due_at,
  }
}

function mergeHumanCuration(items, humanCurationFile) {
  const reviewsByKey = new Map(humanCurationFile.items.map((review) => [review.source_key, review]))
  return items.map((item) => {
    const review = reviewsByKey.get(item.source_key)
    return {
      ...item,
      // Items outside the former Editorial-primary range keep their existing
      // alternative eligibility. Only explicitly reviewed Items may be primary
      // or held back from every recommendation.
      human_curation_status: review?.human_curation_status || item.human_curation_status || 'alternative_only',
      human_curation_reviewed_at: review
        ? humanCurationFile.human_curation_reviewed_at
        : item.human_curation_reviewed_at || humanCurationFile.human_curation_reviewed_at,
      human_curation_gate_version: review
        ? humanCurationFile.human_curation_gate_version
        : item.human_curation_gate_version || humanCurationFile.human_curation_gate_version,
    }
  })
}

export function loadPlacePool(dataPath = DEFAULT_DATA_PATH, editorialPath = DEFAULT_EDITORIAL_PATH) {
  const resolvedDataPath = assertCoupleImportPath(dataPath, 'Place Pool import source')
  const resolvedEditorialPath = assertCoupleImportPath(editorialPath, 'Editorial review source')
  const pool = JSON.parse(fs.readFileSync(resolvedDataPath, 'utf8'))
  const editorialFile = JSON.parse(fs.readFileSync(resolvedEditorialPath, 'utf8'))
  if (editorialFile.dataset_version !== pool.dataset_version) {
    throw new Error('Place Pool과 Editorial review의 dataset_version이 일치해야 합니다.')
  }
  const reviewsByKey = new Map(editorialFile.items.map((review) => [review.source_key, review]))
  return {
    ...pool,
    editorial_gate_version: editorialFile.editorial_gate_version,
    items: pool.items.map((item) => mergeEditorialReview(item, reviewsByKey.get(item.source_key) || {}, editorialFile)),
    editorial_review_keys: editorialFile.items.map((review) => review.source_key),
  }
}

export function loadPhase1B2APlacePool() {
  const base = loadPlacePool()
  const expansionPath = assertCoupleImportPath(PHASE1B2A_DATA_PATH, 'Phase 1B-2A Place Pool source')
  const editorialPath = assertCoupleImportPath(PHASE1B2A_EDITORIAL_PATH, 'Phase 1B-2A Editorial source')
  const expansion = JSON.parse(fs.readFileSync(expansionPath, 'utf8'))
  const editorialFile = JSON.parse(fs.readFileSync(editorialPath, 'utf8'))
  const humanCurationPath = assertCoupleImportPath(PHASE1B2A_HUMAN_CURATION_PATH, 'Phase 1B-2A Human Curation source')
  const humanCurationFile = JSON.parse(fs.readFileSync(humanCurationPath, 'utf8'))
  if (editorialFile.dataset_version !== expansion.dataset_version) {
    throw new Error('Phase 1B-2A Place Pool과 Editorial review의 dataset_version이 일치해야 합니다.')
  }
  if (humanCurationFile.dataset_version !== expansion.dataset_version) {
    throw new Error('Phase 1B-2A Place Pool과 Human Curation review의 dataset_version이 일치해야 합니다.')
  }
  const reviewsByKey = new Map(editorialFile.items.map((review) => [review.source_key, review]))
  const expandedItems = expansion.items.map((item) => mergeEditorialReview(
    item,
    reviewsByKey.get(item.source_key) || {},
    editorialFile,
  ))
  const items = mergeHumanCuration([...base.items, ...expandedItems], humanCurationFile)
  return {
    ...base,
    dataset_kind: expansion.dataset_kind,
    dataset_version: expansion.dataset_version,
    verified_at: expansion.verified_at,
    image_policy: expansion.image_policy,
    editorial_gate_version: editorialFile.editorial_gate_version,
    human_curation_gate_version: humanCurationFile.human_curation_gate_version,
    venues: [...base.venues, ...expansion.venues],
    items,
    editorial_review_keys: [
      ...base.editorial_review_keys,
      ...editorialFile.items.map((review) => review.source_key),
    ],
    human_curation_review_keys: humanCurationFile.items.map((review) => review.source_key),
  }
}

export function loadPhase1B2BPlacePool() {
  const base = loadPhase1B2APlacePool()
  const expansion = phase1B2BExpansion
  const editorialFile = phase1B2BEditorialReviews
  const humanCurationFile = phase1B2BHumanCuration
  if (editorialFile.dataset_version !== expansion.dataset_version) {
    throw new Error('Phase 1B-2B Place Pool과 Editorial review의 dataset_version이 일치해야 합니다.')
  }
  if (humanCurationFile.dataset_version !== expansion.dataset_version) {
    throw new Error('Phase 1B-2B Place Pool과 Human Curation review의 dataset_version이 일치해야 합니다.')
  }
  const reviewsByKey = new Map(editorialFile.items.map((review) => [review.source_key, review]))
  const expandedItems = expansion.items.map((item) => mergeEditorialReview(
    item,
    reviewsByKey.get(item.source_key) || {},
    editorialFile,
  ))
  const items = mergeHumanCuration([...base.items, ...expandedItems], humanCurationFile)
  return {
    ...base,
    dataset_kind: expansion.dataset_kind,
    dataset_version: expansion.dataset_version,
    verified_at: expansion.verified_at,
    image_policy: expansion.image_policy,
    editorial_gate_version: editorialFile.editorial_gate_version,
    human_curation_gate_version: humanCurationFile.human_curation_gate_version,
    venues: [...base.venues, ...expansion.venues],
    items,
    editorial_review_keys: [
      ...base.editorial_review_keys,
      ...editorialFile.items.map((review) => review.source_key),
    ],
    human_curation_review_keys: [
      ...base.human_curation_review_keys,
      ...humanCurationFile.items.map((review) => review.source_key),
    ],
    phase1b2b_item_keys: expansion.items.map((item) => item.source_key),
  }
}

export function validatePlacePool(pool) {
  const errors = []
  const venues = Array.isArray(pool?.venues) ? pool.venues : []
  const items = Array.isArray(pool?.items) ? pool.items : []
  const venueKeys = new Set()
  const kakaoIds = new Set()
  const itemKeys = new Set()

  pushError(errors, pool?.dataset_kind === 'production', 'dataset_kind는 production이어야 합니다.')
  pushError(errors, typeof pool?.dataset_version === 'string' && pool.dataset_version.length > 0, 'dataset_version이 필요합니다.')
  pushError(errors, isValidDate(pool?.verified_at), 'verified_at이 유효한 날짜여야 합니다.')
  pushError(errors, pool?.image_policy === 'deferred_pending_rights_approval', '1B-1 image_policy는 권리 승인 대기 상태여야 합니다.')
  const isPhase1B2A = pool?.dataset_version === 'couple-production-phase1b2a-v1'
  const isPhase1B2B = pool?.dataset_version === 'couple-production-phase1b2b-v1'
  const isHumanCurationPhase = isPhase1B2A || isPhase1B2B
  const venueTargetMet = isPhase1B2B
    ? venues.length >= 120 && venues.length <= 150
    : isPhase1B2A
      ? venues.length >= 60 && venues.length <= 90
      : venues.length >= 20 && venues.length <= 30
  const itemTargetMet = isPhase1B2B
    ? items.length >= 130 && items.length <= 160
    : isPhase1B2A
      ? items.length >= 60 && items.length <= 90
      : items.length >= 20 && items.length <= 30
  pushError(errors, venueTargetMet, `현재 단계의 Venue 범위를 벗어났습니다. 현재 ${venues.length}곳입니다.`)
  pushError(errors, itemTargetMet, `현재 단계의 Recommendation Item 범위를 벗어났습니다. 현재 ${items.length}개입니다.`)

  const imageFields = findImageFields({ venues, items })
  pushError(errors, imageFields.length === 0, `1B-1 데이터에 이미지 필드를 넣을 수 없습니다: ${imageFields.join(', ')}`)
  const familyFields = findForbiddenFamilyFields({ venues, items })
  pushError(errors, familyFields.length === 0, `Couple 데이터에 Family 파생 필드를 넣을 수 없습니다: ${familyFields.join(', ')}`)
  pushError(errors, pool.editorial_gate_version === 'couple-editorial-v1', '승인된 Editorial Gate 버전이 필요합니다.')
  pushError(errors, Array.isArray(pool.editorial_review_keys) && pool.editorial_review_keys.length === items.length, '모든 Recommendation Item에 독립 Editorial review가 하나씩 필요합니다.')
  pushError(errors, new Set(pool.editorial_review_keys || []).size === items.length, 'Editorial review source_key가 중복되거나 Item과 일치하지 않습니다.')
  if (isPhase1B2A) {
    const editorialPrimaryItems = items.filter((item) => item.status === 'active'
      && (item.editorial_tier === 'hero' || (item.editorial_tier === 'standard' && item.editorial_score >= 70))
      && ['available', 'limited', 'walk_in_only'].includes(item.availability_status))
    pushError(errors, pool.human_curation_gate_version === 'couple-human-curation-v1', '승인된 Human Curation Gate 버전이 필요합니다.')
    pushError(errors, Array.isArray(pool.human_curation_review_keys) && pool.human_curation_review_keys.length === 49, '현재 primary 49개에 대한 Human Curation review가 필요합니다.')
    pushError(errors, new Set(pool.human_curation_review_keys || []).size === 49, 'Human Curation source_key가 중복됩니다.')
    pushError(errors, editorialPrimaryItems.length === 49 && editorialPrimaryItems.every((item) => pool.human_curation_review_keys.includes(item.source_key)), 'Human Curation review는 현재 primary 가능 49개와 정확히 일치해야 합니다.')
  }
  if (isPhase1B2B) {
    pushError(errors, pool.human_curation_gate_version === 'couple-human-curation-v1', '승인된 Human Curation Gate 버전이 필요합니다.')
    pushError(errors, Array.isArray(pool.phase1b2b_item_keys) && pool.phase1b2b_item_keys.length === 72, 'Phase 1B-2B 신규 Item 72개 목록이 필요합니다.')
    pushError(errors, new Set(pool.phase1b2b_item_keys || []).size === 72, 'Phase 1B-2B 신규 Item source_key가 중복됩니다.')
    pushError(errors, pool.phase1b2b_item_keys?.every((key) => pool.human_curation_review_keys.includes(key)), 'Phase 1B-2B 신규 Item은 모두 Human Curation review가 필요합니다.')
  }

  for (const [index, venue] of venues.entries()) {
    const label = `venues[${index}]`
    validateDbNotNullContract(errors, {
      pool,
      record: venue,
      columns: COUPLE_VENUE_DB_NOT_NULL_COLUMNS,
      stringColumns: VENUE_REQUIRED_STRING_COLUMNS,
      label,
      recordKind: 'venue',
    })
    pushError(errors, typeof venue.source_key === 'string' && /^[a-z0-9][a-z0-9_-]{2,79}$/.test(venue.source_key), `${label}.source_key가 잘못됐습니다.`)
    pushError(errors, !venueKeys.has(venue.source_key), `${label}.source_key가 중복됩니다: ${venue.source_key}`)
    venueKeys.add(venue.source_key)
    pushError(errors, typeof venue.canonical_name === 'string' && venue.canonical_name.trim().length >= 1, `${label}.canonical_name이 필요합니다.`)
    pushError(errors, !GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(venue.canonical_name)), `${label}에 generic 장소명을 사용할 수 없습니다: ${venue.canonical_name}`)
    pushError(errors, typeof venue.address === 'string' && venue.address.includes('서울'), `${label}.address는 정확한 서울 주소여야 합니다.`)
    pushError(errors, Number.isFinite(venue.latitude) && venue.latitude >= 33 && venue.latitude <= 39, `${label}.latitude가 범위를 벗어났습니다.`)
    pushError(errors, Number.isFinite(venue.longitude) && venue.longitude >= 124 && venue.longitude <= 132, `${label}.longitude가 범위를 벗어났습니다.`)
    pushError(errors, typeof venue.kakao_place_id === 'string' && /^\d+$/.test(venue.kakao_place_id), `${label}.kakao_place_id가 잘못됐습니다.`)
    pushError(errors, !kakaoIds.has(venue.kakao_place_id), `${label}.kakao_place_id가 Venue 사이에서 중복됩니다: ${venue.kakao_place_id}`)
    kakaoIds.add(venue.kakao_place_id)
    pushError(errors, venue.kakao_detail_url === `https://place.map.kakao.com/${venue.kakao_place_id}`, `${label}.kakao_detail_url과 ID가 일치하지 않습니다.`)
    pushError(errors, MEETING_AREAS.includes(venue.meeting_area), `${label}.meeting_area가 잘못됐습니다.`)
    pushError(errors, ['draft', 'active', 'inactive'].includes(venue.status), `${label}.status가 잘못됐습니다.`)
    pushError(errors, isValidDate(venue.verified_at), `${label}.verified_at이 잘못됐습니다.`)
    pushError(errors, Array.isArray(venue.source_references) && venue.source_references.length >= 2, `${label}.source_references는 Kakao와 검수 근거 2개 이상이어야 합니다.`)
    pushError(errors, venue.source_references?.some((source) => source.kind === 'kakao' && source.url === venue.kakao_detail_url), `${label}에 Kakao 출처가 없습니다.`)
  }

  for (const [index, item] of items.entries()) {
    const label = `items[${index}]`
    validateDbNotNullContract(errors, {
      pool,
      record: item,
      columns: COUPLE_RECOMMENDATION_ITEM_DB_NOT_NULL_COLUMNS,
      stringColumns: ITEM_REQUIRED_STRING_COLUMNS,
      label,
      recordKind: 'item',
    })
    pushError(errors, typeof item.source_key === 'string' && /^[a-z0-9][a-z0-9_-]{2,99}$/.test(item.source_key), `${label}.source_key가 잘못됐습니다.`)
    pushError(errors, !itemKeys.has(item.source_key), `${label}.source_key가 중복됩니다: ${item.source_key}`)
    itemKeys.add(item.source_key)
    pushError(errors, venueKeys.has(item.venue_source_key), `${label}.venue_source_key가 존재하지 않습니다: ${item.venue_source_key}`)
    pushError(errors, ['permanent', 'event'].includes(item.item_kind), `${label}.item_kind가 잘못됐습니다.`)
    pushError(errors, typeof item.canonical_name === 'string' && item.canonical_name.trim().length >= 1, `${label}.canonical_name이 필요합니다.`)
    pushError(errors, !GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(item.canonical_name)), `${label}에 generic 추천명을 사용할 수 없습니다: ${item.canonical_name}`)
    pushError(errors, typeof item.summary === 'string' && item.summary.trim().length >= 10, `${label}.summary가 너무 짧습니다.`)
    pushError(errors, Array.isArray(item.activity_traits) && item.activity_traits.length > 0 && item.activity_traits.every((trait) => ACTIVITY_TRAITS.includes(trait)), `${label}.activity_traits가 잘못됐습니다.`)
    pushError(errors, ACTIVITY_TRAITS.includes(item.primary_activity_type), `${label}.primary_activity_type이 잘못됐습니다.`)
    pushError(errors, Array.isArray(item.secondary_activity_types) && item.secondary_activity_types.every((trait) => ACTIVITY_TRAITS.includes(trait)), `${label}.secondary_activity_types가 잘못됐습니다.`)
    pushError(errors, !item.secondary_activity_types?.includes(item.primary_activity_type), `${label}.secondary_activity_types에 primary가 중복될 수 없습니다.`)
    const declaredActivityTraits = new Set([item.primary_activity_type, ...(item.secondary_activity_types || [])])
    pushError(errors, declaredActivityTraits.size === item.activity_traits?.length && item.activity_traits?.every((trait) => declaredActivityTraits.has(trait)), `${label}.activity_traits는 primary/secondary 활동의 합집합이어야 합니다.`)
    pushError(errors, ENERGY_LEVELS.includes(item.energy_level), `${label}.energy_level이 잘못됐습니다.`)
    pushError(errors, NOVELTY_LEVELS.includes(item.novelty_level), `${label}.novelty_level이 잘못됐습니다.`)
    pushError(errors, ['evergreen', 'recent', 'temporary'].includes(item.freshness_class), `${label}.freshness_class가 잘못됐습니다.`)
    pushError(errors, typeof item.freshness_reason === 'string' && item.freshness_reason.trim().length >= 8, `${label}.freshness_reason이 필요합니다.`)
    pushError(errors, isValidDate(item.freshness_verified_at), `${label}.freshness_verified_at이 잘못됐습니다.`)
    pushError(errors, isValidDate(item.freshness_review_due_at), `${label}.freshness_review_due_at이 잘못됐습니다.`)
    pushError(errors, Date.parse(item.freshness_review_due_at) > Date.parse(item.freshness_verified_at), `${label}.freshness_review_due_at은 검수일 이후여야 합니다.`)
    if (['recent', 'temporary'].includes(item.freshness_class)) {
      pushError(errors, isValidDate(item.freshness_expires_at), `${label}.${item.freshness_class}에는 freshness_expires_at이 필요합니다.`)
    }
    if (item.item_kind === 'event' || item.freshness_class === 'temporary') {
      pushError(errors, isValidDate(item.valid_from) && isValidDate(item.valid_until), `${label}.Event/temporary에는 valid_from과 valid_until이 필요합니다.`)
      pushError(errors, Date.parse(item.valid_until) > Date.parse(item.valid_from), `${label}.valid_until은 valid_from 이후여야 합니다.`)
    }
    pushError(errors, PRICE_BANDS.includes(item.price_band), `${label}.price_band가 잘못됐습니다.`)
    pushError(errors, Number.isInteger(item.typical_spend_per_person) && item.typical_spend_per_person >= 0, `${label}.typical_spend_per_person이 잘못됐습니다.`)
    pushError(errors, Number.isInteger(item.required_spend_per_person) && item.required_spend_per_person >= 0, `${label}.required_spend_per_person이 잘못됐습니다.`)
    pushError(errors, item.typical_spend_per_person >= item.required_spend_per_person, `${label}.일반 지출은 필수 지출보다 작을 수 없습니다.`)
    pushError(errors, ['free', 'admission', 'minimum_purchase', 'optional_purchase', 'program_fee', 'variable'].includes(item.price_basis), `${label}.price_basis가 잘못됐습니다.`)
    pushError(errors, typeof item.price_note === 'string' && item.price_note.trim().length >= 2 && item.price_note.trim().length <= 240, `${label}.price_note는 2~240자의 가격 설명이어야 합니다.`)
    if (item.price_band === 'free') {
      pushError(errors, item.typical_spend_per_person === 0 && item.required_spend_per_person === 0 && item.price_basis === 'free', `${label}.무료 가격 구조가 서로 모순됩니다.`)
    }
    pushError(errors, Number.isInteger(item.recommended_duration_minutes) && item.recommended_duration_minutes >= 30 && item.recommended_duration_minutes <= 720, `${label}.recommended_duration_minutes가 잘못됐습니다.`)
    pushError(errors, ['indoor', 'outdoor', 'mixed'].includes(item.indoor_outdoor), `${label}.indoor_outdoor가 잘못됐습니다.`)
    pushError(errors, ['low', 'medium', 'high'].includes(item.walking_level), `${label}.walking_level이 잘못됐습니다.`)
    pushError(errors, ['low', 'medium', 'high'].includes(item.wait_risk), `${label}.wait_risk가 잘못됐습니다.`)
    pushError(errors, typeof item.car_required === 'boolean', `${label}.car_required가 잘못됐습니다.`)
    pushError(errors, item.mobility_score == null || (Number.isFinite(item.mobility_score) && item.mobility_score >= 0 && item.mobility_score <= 5), `${label}.mobility_score가 잘못됐습니다.`)
    pushError(errors, isValidDate(item.verified_at), `${label}.verified_at이 잘못됐습니다.`)
    pushError(errors, Array.isArray(item.source_references) && item.source_references.length > 0, `${label}.source_references가 필요합니다.`)
    for (const field of [
      'couple_relevance',
      'destination_appeal',
      'current_appeal',
      'distinctiveness',
      'conversation_or_experience_value',
      'repeat_commonness_risk',
    ]) {
      pushError(errors, Number.isInteger(item[field]) && item[field] >= 1 && item[field] <= 5, `${label}.${field}는 1~5 정수여야 합니다.`)
    }
    pushError(errors, Number.isInteger(item.editorial_score) && item.editorial_score === calculateEditorialScore(item), `${label}.editorial_score가 승인된 계산식과 일치하지 않습니다.`)
    pushError(errors, EDITORIAL_TIERS.includes(item.editorial_tier), `${label}.editorial_tier가 잘못됐습니다.`)
    pushError(errors, typeof item.editorial_rationale === 'string' && item.editorial_rationale.trim().length >= 20, `${label}.editorial_rationale이 너무 짧습니다.`)
    pushError(errors, isValidDate(item.editorial_reviewed_at), `${label}.editorial_reviewed_at이 잘못됐습니다.`)
    pushError(errors, isValidDate(item.editorial_review_due_at) && Date.parse(item.editorial_review_due_at) > Date.parse(item.editorial_reviewed_at), `${label}.editorial_review_due_at이 잘못됐습니다.`)
    pushError(errors, Array.isArray(item.editorial_evidence_refs) && item.editorial_evidence_refs.length > 0, `${label}.editorial_evidence_refs가 필요합니다.`)
    pushError(errors, item.editorial_gate_version === pool.editorial_gate_version, `${label}.editorial_gate_version이 일치하지 않습니다.`)
    pushError(errors, item.curation_origin === 'independent_couple_research', `${label}.curation_origin은 독립 Couple 검수여야 합니다.`)
    pushError(errors, typeof item.booking_required === 'boolean', `${label}.booking_required가 잘못됐습니다.`)
    pushError(errors, item.booking_url == null || /^https:\/\//.test(item.booking_url), `${label}.booking_url은 HTTPS URL이어야 합니다.`)
    pushError(errors, item.booking_open_at == null || isValidDate(item.booking_open_at), `${label}.booking_open_at이 잘못됐습니다.`)
    pushError(errors, item.booking_close_at == null || isValidDate(item.booking_close_at), `${label}.booking_close_at이 잘못됐습니다.`)
    pushError(errors, AVAILABILITY_STATUSES.includes(item.availability_status), `${label}.availability_status가 잘못됐습니다.`)
    pushError(errors, isValidDate(item.availability_verified_at), `${label}.availability_verified_at이 잘못됐습니다.`)
    pushError(errors, isValidDate(item.availability_review_due_at) && Date.parse(item.availability_review_due_at) > Date.parse(item.availability_verified_at), `${label}.availability_review_due_at이 잘못됐습니다.`)
    if (item.booking_required) pushError(errors, Boolean(item.booking_url), `${label}.예약 필수 Item에는 booking_url이 필요합니다.`)
    if (item.editorial_tier === 'reject') pushError(errors, item.status === 'inactive', `${label}.reject Item은 inactive여야 합니다.`)
    if (item.status === 'active') {
      pushError(errors, item.editorial_tier !== 'reject', `${label}.active Item은 reject일 수 없습니다.`)
      pushError(errors, item.availability_status !== 'unknown', `${label}.active Item은 availability unknown일 수 없습니다.`)
    }
    if (isHumanCurationPhase) {
      pushError(errors, HUMAN_CURATION_STATUSES.includes(item.human_curation_status), `${label}.human_curation_status가 잘못됐습니다.`)
      pushError(errors, isValidDate(item.human_curation_reviewed_at), `${label}.human_curation_reviewed_at이 잘못됐습니다.`)
      pushError(errors, item.human_curation_gate_version === pool.human_curation_gate_version, `${label}.human_curation_gate_version이 일치하지 않습니다.`)
    }
  }

  const eventsByVenue = new Map()
  for (const item of items.filter((entry) => entry.item_kind === 'event')) {
    eventsByVenue.set(item.venue_source_key, (eventsByVenue.get(item.venue_source_key) || 0) + 1)
  }
  pushError(errors, [...eventsByVenue.values()].some((count) => count >= 2), '동일 Venue에 여러 Event가 연결되는 1B-1 검증 사례가 필요합니다.')

  return { ok: errors.length === 0, errors }
}

export function buildConsensusPlaces(pool) {
  const venuesByKey = new Map(pool.venues.map((venue) => [venue.source_key, venue]))
  return pool.items.map((item) => {
    const venue = venuesByKey.get(item.venue_source_key)
    return {
      id: item.source_key,
      name: item.canonical_name,
      meetingArea: venue.meeting_area,
      datasetKind: pool.dataset_kind,
      datasetVersion: pool.dataset_version,
      venueStatus: venue.status,
      status: item.status,
      validFrom: item.valid_from,
      validUntil: item.valid_until,
      freshnessClass: item.freshness_class,
      freshnessExpiresAt: item.freshness_expires_at,
      freshnessReviewDueAt: item.freshness_review_due_at,
      bookingRequired: item.booking_required,
      bookingUrl: item.booking_url,
      bookingOpenAt: item.booking_open_at,
      bookingCloseAt: item.booking_close_at,
      availabilityStatus: item.availability_status,
      availabilityVerifiedAt: item.availability_verified_at,
      availabilityReviewDueAt: item.availability_review_due_at,
      curationOrigin: item.curation_origin,
      editorialTier: item.editorial_tier,
      editorialScore: item.editorial_score,
      editorialRationale: item.editorial_rationale,
      editorialReviewedAt: item.editorial_reviewed_at,
      editorialReviewDueAt: item.editorial_review_due_at,
      editorialEvidenceRefs: item.editorial_evidence_refs,
      editorialGateVersion: item.editorial_gate_version,
      humanCurationStatus: item.human_curation_status,
      humanCurationReviewedAt: item.human_curation_reviewed_at,
      humanCurationGateVersion: item.human_curation_gate_version,
      category: item.category,
      activityType: item.primary_activity_type,
      primaryActivityType: item.primary_activity_type,
      secondaryActivityTypes: item.secondary_activity_types,
      energy: item.energy_level,
      novelty: item.novelty_level,
      budgetPerPerson: item.typical_spend_per_person,
      durationMinutes: item.recommended_duration_minutes,
      indoorOutdoor: item.indoor_outdoor,
      walkingLevel: item.walking_level,
      waitRisk: item.wait_risk,
      carRequired: item.car_required,
      mobilityScore: item.mobility_score,
      verifiedAt: item.verified_at,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
      kakaoPlaceId: venue.kakao_place_id,
      kakaoDetailUrl: venue.kakao_detail_url,
    }
  })
}

function getEffectiveNovelty(item, asOf) {
  const stale = Date.parse(item.freshness_review_due_at) <= asOf.getTime()
    || (item.freshness_expires_at && Date.parse(item.freshness_expires_at) <= asOf.getTime())
  return item.novelty_level === 'new' && stale ? 'balanced' : item.novelty_level
}

function vetoCoverage(items) {
  return {
    outdoor_safe: items.filter((item) => item.indoor_outdoor !== 'outdoor').length,
    long_walk_safe: items.filter((item) => item.walking_level !== 'high').length,
    long_wait_safe: items.filter((item) => item.wait_risk !== 'high').length,
    cafe_safe: items.filter((item) => item.primary_activity_type !== 'cafe').length,
    high_cost_safe: items.filter((item) => item.required_spend_per_person <= 20000).length,
    car_required_safe: items.filter((item) => !item.car_required).length,
  }
}

export function buildCoverageReport(pool, asOfValue = pool.verified_at) {
  const asOf = new Date(asOfValue)
  if (Number.isNaN(asOf.getTime())) throw new Error(`유효하지 않은 coverage 기준 시각: ${asOfValue}`)
  const isPhase1B2A = pool.dataset_version === 'couple-production-phase1b2a-v1'
  const isPhase1B2B = pool.dataset_version === 'couple-production-phase1b2b-v1'
  const isHumanCurationPhase = isPhase1B2A || isPhase1B2B
  const venuesByKey = new Map(pool.venues.map((venue) => [venue.source_key, venue]))
  const consensusPlaces = buildConsensusPlaces(pool)
  const gatesByKey = new Map(consensusPlaces.map((place) => [place.id, evaluateRecommendationGates(place, asOf)]))
  const eligibleItems = pool.items.filter((item) => gatesByKey.get(item.source_key).alternativeEligible)
  const primaryItems = pool.items.filter((item) => gatesByKey.get(item.source_key).primaryEligible)
  const scheduledItems = pool.items.filter((item) => item.valid_from && Date.parse(item.valid_from) > asOf.getTime())

  const areas = Object.fromEntries(MEETING_AREAS.map((area) => {
    const areaVenues = pool.venues.filter((venue) => venue.meeting_area === area && venue.status === 'active')
    const areaItems = eligibleItems.filter((item) => venuesByKey.get(item.venue_source_key).meeting_area === area)
    const activityCounts = Object.fromEntries(ACTIVITY_TRAITS.map((trait) => [trait, areaItems.filter((item) => item.activity_traits.includes(trait)).length]))
    const energyCounts = countBy(areaItems.map((item) => item.energy_level), ENERGY_LEVELS)
    const noveltyCounts = countBy(areaItems.map((item) => getEffectiveNovelty(item, asOf)), NOVELTY_LEVELS)
    const priceCounts = countBy(areaItems.map((item) => item.price_band), PRICE_BANDS)
    const budgetPreferenceCounts = {
      under_20000: areaItems.filter((item) => ['free', 'under_20000'].includes(item.price_band)).length,
      under_40000: areaItems.filter((item) => ['free', 'under_20000', 'under_40000'].includes(item.price_band)).length,
      any: areaItems.length,
    }
    const timeCounts = {
      under_120_minutes: areaItems.filter((item) => item.recommended_duration_minutes <= 120).length,
      under_240_minutes: areaItems.filter((item) => item.recommended_duration_minutes <= 240).length,
      unlimited: areaItems.length,
    }
    const vetoCounts = vetoCoverage(areaItems)
    const gaps = [
      ...Object.entries(activityCounts).filter(([, count]) => count === 0).map(([key]) => `activity:${key}`),
      ...Object.entries(energyCounts).filter(([, count]) => count === 0).map(([key]) => `energy:${key}`),
      ...Object.entries(noveltyCounts).filter(([, count]) => count === 0).map(([key]) => `novelty:${key}`),
      ...Object.entries(budgetPreferenceCounts).filter(([, count]) => count === 0).map(([key]) => `budget:${key}`),
      ...Object.entries(timeCounts).filter(([, count]) => count === 0).map(([key]) => `time:${key}`),
      ...Object.entries(vetoCounts).filter(([, count]) => count === 0).map(([key]) => `veto:${key}`),
    ]
    return [area, {
      venue_count: areaVenues.length,
      eligible_item_count: areaItems.length,
      primary_item_count: primaryItems.filter((item) => venuesByKey.get(item.venue_source_key).meeting_area === area).length,
      activity: activityCounts,
      energy: energyCounts,
      novelty: noveltyCounts,
      price: priceCounts,
      budget_preference: budgetPreferenceCounts,
      duration: timeCounts,
      veto_safe_candidates: vetoCounts,
      gaps,
    }]
  }))

  return {
    dataset_version: pool.dataset_version,
    as_of: asOf.toISOString(),
    phase: isPhase1B2B ? '1B-2B' : isPhase1B2A ? '1B-2A' : '1B-1',
    beta_ready: false,
    beta_readiness_reason: isPhase1B2B
      ? '1B-2B는 로컬 검수 dataset이며 remote 반영과 공개 /couple 전환 전 승인이 필요합니다.'
      : isPhase1B2A
        ? '1B-2A는 내부 checkpoint dataset이며 공개 /couple은 fixture를 유지합니다.'
        : '1B-1은 스키마·태깅 검증용 24개 Venue 파일럿이며, 공개 beta의 품질·coverage gate를 아직 통과시키지 않습니다.',
    totals: {
      venues: pool.venues.length,
      items: pool.items.length,
      eligible_items: eligibleItems.length,
      primary_eligible_items: primaryItems.length,
      scheduled_items: scheduledItems.length,
      event_items: pool.items.filter((item) => item.item_kind === 'event').length,
      recent_items: pool.items.filter((item) => item.freshness_class === 'recent').length,
      temporary_items: pool.items.filter((item) => item.freshness_class === 'temporary').length,
    },
    quality_checks: {
      stage_venue_target_met: isPhase1B2B
        ? pool.venues.length >= 120 && pool.venues.length <= 150
        : isPhase1B2A
          ? pool.venues.length >= 60 && pool.venues.length <= 90
          : pool.venues.length >= 20 && pool.venues.length <= 30,
      phase1b2a_area_target_met: !isPhase1B2A
        || Object.values(areas).every((area) => area.eligible_item_count >= 20 && area.eligible_item_count <= 25),
      phase1b2b_area_target_met: !isPhase1B2B
        || Object.values(areas).every((area) => area.eligible_item_count >= 40 && area.eligible_item_count <= 50),
      every_area_has_venues: MEETING_AREAS.every((area) => pool.venues.some((venue) => venue.meeting_area === area)),
      kakao_links_complete: pool.venues.every((venue) => venue.kakao_detail_url === `https://place.map.kakao.com/${venue.kakao_place_id}`),
      no_generic_names: [...pool.venues, ...pool.items].every((entry) => !GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(entry.canonical_name))),
      no_image_fields: findImageFields({ venues: pool.venues, items: pool.items }).length === 0,
      freshness_lifecycle_complete: pool.items.every((item) => !['recent', 'temporary'].includes(item.freshness_class) || Boolean(item.freshness_expires_at)),
      event_venue_one_to_many_verified: [...new Set(pool.items.filter((item) => item.item_kind === 'event').map((item) => item.venue_source_key))]
        .some((venueKey) => pool.items.filter((item) => item.item_kind === 'event' && item.venue_source_key === venueKey).length >= 2),
      price_model_complete: pool.items.every((item) => PRICE_BANDS.includes(item.price_band) && Number.isInteger(item.typical_spend_per_person) && Number.isInteger(item.required_spend_per_person) && Boolean(item.price_basis)),
      editorial_reviews_complete: pool.items.every((item) => item.curation_origin === 'independent_couple_research' && EDITORIAL_TIERS.includes(item.editorial_tier)),
      rejected_items_inactive: pool.items.every((item) => item.editorial_tier !== 'reject' || item.status === 'inactive'),
      family_derivation_fields_absent: findForbiddenFamilyFields({ venues: pool.venues, items: pool.items }).length === 0,
      availability_reviews_complete: pool.items.every((item) => isValidDate(item.availability_verified_at) && isValidDate(item.availability_review_due_at)),
      human_curation_reviews_complete: !isHumanCurationPhase || pool.items.every((item) => HUMAN_CURATION_STATUSES.includes(item.human_curation_status)
        && item.human_curation_gate_version === pool.human_curation_gate_version
        && isValidDate(item.human_curation_reviewed_at)),
    },
    areas,
    scheduled_item_keys: scheduledItems.map((item) => item.source_key),
  }
}

function formatCounts(record) {
  return Object.entries(record).map(([key, count]) => `${key} ${count}`).join(', ')
}

export function renderCoverageMarkdown(report) {
  const lines = [
    `# Couple Phase ${report.phase} Preference Coverage Report`,
    '',
    `- Dataset: \`${report.dataset_version}\``,
    `- 기준 시각: ${report.as_of}`,
    `- Venue: ${report.totals.venues}곳`,
    `- Recommendation Item: ${report.totals.items}개 (현재 추천 가능 ${report.totals.eligible_items}, 강력추천 가능 ${report.totals.primary_eligible_items}, 예정 ${report.totals.scheduled_items})`,
    `- 공개 beta 준비: 아니요 — ${report.beta_readiness_reason}`,
    '',
    '## Quality checks',
    '',
    ...Object.entries(report.quality_checks).map(([key, passed]) => `- ${passed ? 'PASS' : 'FAIL'} — ${key}`),
    '',
    '## 권역별 matrix',
    '',
  ]
  for (const [area, coverage] of Object.entries(report.areas)) {
    lines.push(
      `### ${area}`,
      '',
      `- Venue ${coverage.venue_count}, 현재 추천 가능 Item ${coverage.eligible_item_count}, 강력추천 가능 Item ${coverage.primary_item_count}`,
      `- 활동: ${formatCounts(coverage.activity)}`,
      `- 에너지: ${formatCounts(coverage.energy)}`,
      `- 새로움: ${formatCounts(coverage.novelty)}`,
      `- 가격: ${formatCounts(coverage.price)}`,
      `- 예산 선택 수용 후보: ${formatCounts(coverage.budget_preference)}`,
      `- 시간: ${formatCounts(coverage.duration)}`,
      `- veto 안전 후보: ${formatCounts(coverage.veto_safe_candidates)}`,
      `- 다음 보강 gap: ${coverage.gaps.length ? coverage.gaps.join(', ') : '없음'}`,
      '',
    )
  }
  lines.push(
    '## 이미지',
    '',
    `- ${report.phase}에는 이미지 필드와 이미지 URL이 없습니다.`,
    '- 권리·출처·보관 정책을 별도 승인받기 전에는 SNS·검색 결과 이미지를 수집하거나 사용하지 않습니다.',
    '',
  )
  return `${lines.join('\n')}\n`
}

function venuePayload(venue) {
  return {
    source_key: venue.source_key,
    canonical_name: venue.canonical_name,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    kakao_place_id: venue.kakao_place_id,
    kakao_detail_url: venue.kakao_detail_url,
    meeting_area: venue.meeting_area,
    status: venue.status,
    verified_at: venue.verified_at,
    source_references: venue.source_references,
    updated_at: new Date().toISOString(),
  }
}

function itemPayload(item, venueId, pool) {
  const { venue_source_key: _venueSourceKey, ...storedItem } = item
  return {
    ...storedItem,
    venue_id: venueId,
    dataset_kind: pool.dataset_kind,
    dataset_version: pool.dataset_version,
    updated_at: new Date().toISOString(),
  }
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlValue(value, type = null) {
  if (value == null) return type ? `null::${type}` : 'null'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (type === 'jsonb') return `${sqlText(JSON.stringify(value))}::jsonb`
  if (type === 'text[]') return `array[${value.map(sqlText).join(', ')}]::text[]`
  if (type) return `${sqlText(value)}::${type}`
  return sqlText(value)
}

function updateAssignments(columns) {
  return columns.map((column) => `${column} = excluded.${column}`).join(',\n    ')
}

export function buildUpsertSql(pool) {
  const venueColumns = [
    'source_key', 'canonical_name', 'address', 'latitude', 'longitude',
    'kakao_place_id', 'kakao_detail_url', 'meeting_area', 'status',
    'verified_at', 'source_references', 'updated_at',
  ]
  const venueUpdates = venueColumns.filter((column) => column !== 'source_key')
  const venueStatements = pool.venues.map((venue) => {
    const values = [
      sqlValue(venue.source_key), sqlValue(venue.canonical_name), sqlValue(venue.address),
      sqlValue(venue.latitude), sqlValue(venue.longitude), sqlValue(venue.kakao_place_id),
      sqlValue(venue.kakao_detail_url), sqlValue(venue.meeting_area), sqlValue(venue.status),
      sqlValue(venue.verified_at, 'timestamptz'), sqlValue(venue.source_references, 'jsonb'), 'now()',
    ]
    return `insert into public.couple_venues (${venueColumns.join(', ')})\nvalues (${values.join(', ')})\non conflict (source_key) do update set\n    ${updateAssignments(venueUpdates)};`
  })

  const itemColumns = [
    'source_key', 'venue_id', 'item_kind', 'canonical_name', 'summary', 'category',
    'activity_traits', 'primary_activity_type', 'secondary_activity_types',
    'energy_level', 'novelty_level', 'freshness_class',
    'freshness_reason', 'freshness_verified_at', 'freshness_review_due_at',
    'freshness_expires_at', 'price_band', 'typical_spend_per_person',
    'required_spend_per_person', 'price_basis', 'price_note',
    'recommended_duration_minutes', 'indoor_outdoor', 'walking_level', 'wait_risk',
    'car_required', 'mobility_score', 'status', 'valid_from', 'valid_until',
    'verified_at', 'source_references', 'couple_relevance', 'destination_appeal',
    'current_appeal', 'distinctiveness', 'conversation_or_experience_value',
    'repeat_commonness_risk', 'editorial_score', 'editorial_tier',
    'editorial_rationale', 'editorial_reviewed_at', 'editorial_review_due_at',
    'editorial_evidence_refs', 'editorial_gate_version', 'curation_origin',
    'booking_required', 'booking_url', 'booking_open_at', 'booking_close_at',
    'availability_status', 'availability_verified_at', 'availability_review_due_at',
    'human_curation_status', 'human_curation_reviewed_at', 'human_curation_gate_version',
    'dataset_kind', 'dataset_version', 'updated_at',
  ]
  const itemUpdates = itemColumns.filter((column) => column !== 'source_key')
  const itemStatements = pool.items.map((item) => {
    const values = [
      sqlValue(item.source_key),
      `(select id from public.couple_venues where source_key = ${sqlValue(item.venue_source_key)})`,
      sqlValue(item.item_kind), sqlValue(item.canonical_name), sqlValue(item.summary), sqlValue(item.category),
      sqlValue(item.activity_traits, 'text[]'), sqlValue(item.primary_activity_type),
      sqlValue(item.secondary_activity_types, 'text[]'), sqlValue(item.energy_level), sqlValue(item.novelty_level),
      sqlValue(item.freshness_class), sqlValue(item.freshness_reason),
      sqlValue(item.freshness_verified_at, 'timestamptz'), sqlValue(item.freshness_review_due_at, 'timestamptz'),
      sqlValue(item.freshness_expires_at, 'timestamptz'), sqlValue(item.price_band),
      sqlValue(item.typical_spend_per_person), sqlValue(item.required_spend_per_person),
      sqlValue(item.price_basis), sqlValue(item.price_note), sqlValue(item.recommended_duration_minutes),
      sqlValue(item.indoor_outdoor), sqlValue(item.walking_level), sqlValue(item.wait_risk),
      sqlValue(item.car_required), sqlValue(item.mobility_score), sqlValue(item.status),
      sqlValue(item.valid_from, 'timestamptz'), sqlValue(item.valid_until, 'timestamptz'),
      sqlValue(item.verified_at, 'timestamptz'), sqlValue(item.source_references, 'jsonb'),
      sqlValue(item.couple_relevance), sqlValue(item.destination_appeal), sqlValue(item.current_appeal),
      sqlValue(item.distinctiveness), sqlValue(item.conversation_or_experience_value),
      sqlValue(item.repeat_commonness_risk), sqlValue(item.editorial_score), sqlValue(item.editorial_tier),
      sqlValue(item.editorial_rationale), sqlValue(item.editorial_reviewed_at, 'timestamptz'),
      sqlValue(item.editorial_review_due_at, 'timestamptz'), sqlValue(item.editorial_evidence_refs, 'jsonb'),
      sqlValue(item.editorial_gate_version), sqlValue(item.curation_origin), sqlValue(item.booking_required),
      sqlValue(item.booking_url), sqlValue(item.booking_open_at, 'timestamptz'),
      sqlValue(item.booking_close_at, 'timestamptz'), sqlValue(item.availability_status),
      sqlValue(item.availability_verified_at, 'timestamptz'), sqlValue(item.availability_review_due_at, 'timestamptz'),
      sqlValue(item.human_curation_status), sqlValue(item.human_curation_reviewed_at, 'timestamptz'),
      sqlValue(item.human_curation_gate_version),
      sqlValue(pool.dataset_kind), sqlValue(pool.dataset_version), 'now()',
    ]
    return `insert into public.couple_recommendation_items (${itemColumns.join(', ')})\nvalues (${values.join(', ')})\non conflict (source_key) do update set\n    ${updateAssignments(itemUpdates)};`
  })

  return [
    `-- Generated from independent Couple dataset ${pool.dataset_version}.`,
    '-- Additive upsert only: this script never deletes or deactivates missing rows.',
    'begin;',
    ...venueStatements,
    ...itemStatements,
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_editorial_scores_check;',
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_editorial_tier_check;',
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_curation_origin_check;',
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_editorial_lifecycle_check;',
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_booking_window_check;',
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_active_review_complete_check;',
    'alter table public.couple_recommendation_items validate constraint couple_recommendation_items_human_curation_lifecycle_check;',
    'commit;',
    '',
    'select',
    "  (select count(*) from public.couple_venues where status = 'active') as active_venues,",
    `  (select count(*) from public.couple_recommendation_items where dataset_version = ${sqlValue(pool.dataset_version)}) as pilot_items,`,
    `  (select count(*) from public.couple_recommendation_catalog where dataset_version = ${sqlValue(pool.dataset_version)} and recommendation_eligible) as eligible_items;`,
    '',
  ].join('\n\n')
}

export async function upsertPlacePool(pool) {
  const supabaseUrl = readEnvValue('VITE_SUPABASE_URL')
  const serviceRoleKey = readEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('실제 upsert에는 VITE_SUPABASE_URL과 서버 전용 SUPABASE_SERVICE_ROLE_KEY가 필요합니다. publishable key로는 실행하지 않습니다.')
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: storedVenues, error: venueError } = await client
    .from('couple_venues')
    .upsert(pool.venues.map(venuePayload), { onConflict: 'source_key' })
    .select('id, source_key')
  if (venueError) throw venueError

  const venueIdByKey = new Map(storedVenues.map((venue) => [venue.source_key, venue.id]))
  const { data: storedItems, error: itemError } = await client
    .from('couple_recommendation_items')
    .upsert(pool.items.map((item) => itemPayload(item, venueIdByKey.get(item.venue_source_key), pool)), { onConflict: 'source_key' })
    .select('id, source_key')
  if (itemError) throw itemError

  return { venues: storedVenues.length, items: storedItems.length }
}

function normalizeText(value) {
  return String(value || '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase()
}

function haversineMeters(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = (value) => value * (Math.PI / 180)
  const latitudeDelta = toRadians(latitude2 - latitude1)
  const longitudeDelta = toRadians(longitude2 - longitude1)
  const firstLatitude = toRadians(latitude1)
  const secondLatitude = toRadians(latitude2)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export async function verifyKakaoPlaces(pool) {
  const kakaoKey = readEnvValue('KAKAO_REST_API_KEY')
  if (!kakaoKey) throw new Error('KAKAO_REST_API_KEY가 필요합니다.')
  const results = []
  for (const venue of pool.venues) {
    const params = new URLSearchParams({
      query: venue.canonical_name,
      x: String(venue.longitude),
      y: String(venue.latitude),
      radius: '3000',
      size: '15',
      sort: 'accuracy',
    })
    const response = await fetch(`${KAKAO_SEARCH_URL}?${params}`, {
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
    })
    if (!response.ok) throw new Error(`Kakao Local API 오류: ${response.status}`)
    const body = await response.json()
    const candidate = body.documents?.find((entry) => String(entry.id) === venue.kakao_place_id)
    const distance = candidate
      ? haversineMeters(venue.latitude, venue.longitude, Number(candidate.y), Number(candidate.x))
      : null
    const nameCompatible = candidate
      ? normalizeText(candidate.place_name).includes(normalizeText(venue.canonical_name))
        || normalizeText(venue.canonical_name).includes(normalizeText(candidate.place_name))
      : false
    results.push({
      source_key: venue.source_key,
      expected_name: venue.canonical_name,
      kakao_place_id: venue.kakao_place_id,
      found: Boolean(candidate),
      kakao_name: candidate?.place_name || null,
      kakao_address: candidate?.road_address_name || candidate?.address_name || null,
      coordinate_distance_meters: distance == null ? null : Math.round(distance),
      passed: Boolean(candidate) && distance <= 50 && nameCompatible,
    })
  }
  return results
}

function writeReports(report, phase) {
  const jsonPath = phase === '1b2b'
    ? PHASE1B2B_REPORT_JSON_PATH
    : phase === '1b2a'
      ? PHASE1B2A_REPORT_JSON_PATH
      : REPORT_JSON_PATH
  const markdownPath = phase === '1b2b'
    ? PHASE1B2B_REPORT_MARKDOWN_PATH
    : phase === '1b2a'
      ? PHASE1B2A_REPORT_MARKDOWN_PATH
      : REPORT_MARKDOWN_PATH
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(markdownPath, renderCoverageMarkdown(report))
  return markdownPath
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const isPhase1B2A = args.has('--phase1b2a')
  const isPhase1B2B = args.has('--phase1b2b')
  if (isPhase1B2A && isPhase1B2B) throw new Error('Phase selector는 하나만 지정해야 합니다.')
  const phase = isPhase1B2B ? '1b2b' : isPhase1B2A ? '1b2a' : '1b1'
  const pool = isPhase1B2B ? loadPhase1B2BPlacePool() : isPhase1B2A ? loadPhase1B2APlacePool() : loadPlacePool()
  const validation = validatePlacePool(pool)
  if (!validation.ok) {
    for (const error of validation.errors) console.error(`ERROR ${error}`)
    process.exitCode = 1
    return
  }

  const report = buildCoverageReport(pool)
  console.log(`PASS schema/data validation — Venue ${pool.venues.length}, Item ${pool.items.length}`)
  console.log(`Coverage as-of ${report.as_of} — eligible ${report.totals.eligible_items}, primary ${report.totals.primary_eligible_items}, scheduled ${report.totals.scheduled_items}`)
  for (const [area, coverage] of Object.entries(report.areas)) {
    console.log(`${area}: Venue ${coverage.venue_count}, Item ${coverage.eligible_item_count}, gaps ${coverage.gaps.join(', ') || 'none'}`)
  }

  if (args.has('--write-report')) {
    const reportPath = writeReports(report, phase)
    console.log(`Coverage report written: ${path.relative(ROOT_DIR, reportPath)}`)
  }

  if (args.has('--write-sql')) {
    const sqlPath = isPhase1B2B ? PHASE1B2B_UPSERT_SQL_PATH : isPhase1B2A ? PHASE1B2A_UPSERT_SQL_PATH : UPSERT_SQL_PATH
    fs.mkdirSync(path.dirname(sqlPath), { recursive: true })
    fs.writeFileSync(sqlPath, buildUpsertSql(pool))
    console.log(`Additive upsert SQL written: ${path.relative(ROOT_DIR, sqlPath)}`)
  }

  if (args.has('--verify-kakao')) {
    const kakaoResults = await verifyKakaoPlaces(pool)
    for (const result of kakaoResults) {
      console.log(`${result.passed ? 'PASS' : 'FAIL'} Kakao ${result.expected_name} — ${result.kakao_place_id} (${result.coordinate_distance_meters ?? '-'}m)`)
    }
    const failures = kakaoResults.filter((result) => !result.passed)
    if (failures.length) throw new Error(`Kakao 검증 실패 ${failures.length}곳`)
  }

  if (args.has('--upsert')) {
    const stored = await upsertPlacePool(pool)
    console.log(`UPSERT complete — Venue ${stored.venues}, Item ${stored.items}; 삭제·누락행 비활성화 없음`)
  } else {
    console.log('DRY RUN complete — DB write 없음. 실제 반영은 --upsert를 명시해야 합니다.')
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

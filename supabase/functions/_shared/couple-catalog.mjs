import { FIXTURE_DATASET_VERSION, getFixturePlaces } from './couple-fixtures.mjs'

export const PRODUCTION_DATASET_VERSION = 'couple-production-phase1b2b-v1'
export const COUPLE_PLACE_SOURCES = Object.freeze({
  fixture: 'fixture',
  production: 'production',
})

const CATALOG_SELECT_COLUMNS = [
  'id',
  'source_key',
  'canonical_name',
  'summary',
  'category',
  'energy_level',
  'effective_novelty_level',
  'freshness_class',
  'freshness_expires_at',
  'freshness_review_due_at',
  'typical_spend_per_person',
  'recommended_duration_minutes',
  'indoor_outdoor',
  'walking_level',
  'wait_risk',
  'car_required',
  'mobility_score',
  'status',
  'valid_from',
  'valid_until',
  'verified_at',
  'dataset_kind',
  'dataset_version',
  'venue_name',
  'address',
  'latitude',
  'longitude',
  'kakao_place_id',
  'kakao_detail_url',
  'meeting_area',
  'curation_origin',
  'editorial_tier',
  'editorial_score',
  'editorial_rationale',
  'editorial_reviewed_at',
  'editorial_review_due_at',
  'editorial_evidence_refs',
  'editorial_gate_version',
  'booking_required',
  'booking_url',
  'booking_open_at',
  'booking_close_at',
  'availability_status',
  'availability_verified_at',
  'availability_review_due_at',
  'operational_eligible',
  'editorial_eligible',
  'recommendation_eligible',
  'primary_recommendation_eligible',
  'alternative_recommendation_eligible',
  'primary_activity_type',
  'secondary_activity_types',
  'human_curation_status',
  'human_curation_reviewed_at',
  'human_curation_gate_version',
  'human_curation_eligible',
].join(',')

const MEETING_AREA_LABELS = Object.freeze({
  seongsu: '성수·서울숲',
  hongdae: '홍대·연남',
  jongno_euljiro: '종로·을지로',
})

const PUBLIC_PLACE_FIELDS = Object.freeze([
  'id',
  'name',
  'description',
  'area',
  'meetingArea',
  'category',
  'activityType',
  'energy',
  'novelty',
  'budgetPerPerson',
  'durationMinutes',
  'indoorOutdoor',
  'walkingLevel',
  'waitRisk',
  'address',
  'latitude',
  'longitude',
  'kakaoPlaceId',
  'kakaoPlaceName',
  'kakaoPlaceUrl',
])

export class CatalogUnavailableError extends Error {
  constructor(message = 'Production Couple catalog is unavailable.', cause) {
    super(message, cause ? { cause } : undefined)
    this.name = 'CatalogUnavailableError'
    this.code = 'CATALOG_UNAVAILABLE'
  }
}

export function resolveCouplePlaceSource(value) {
  if (value == null || String(value).trim() === '') return COUPLE_PLACE_SOURCES.fixture
  const normalized = String(value).trim().toLowerCase()
  if (normalized === COUPLE_PLACE_SOURCES.fixture || normalized === COUPLE_PLACE_SOURCES.production) {
    return normalized
  }
  throw new Error('INVALID_COUPLE_PLACE_SOURCE')
}

function numberValue(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function assertCatalogRow(row, meetingArea) {
  const requiredStrings = [
    'id', 'source_key', 'canonical_name', 'summary', 'category', 'energy_level',
    'effective_novelty_level', 'freshness_class', 'indoor_outdoor', 'walking_level',
    'wait_risk', 'status', 'dataset_kind', 'dataset_version', 'venue_name',
    'address', 'kakao_place_id', 'kakao_detail_url', 'meeting_area', 'curation_origin',
    'editorial_tier', 'editorial_rationale', 'editorial_reviewed_at',
    'editorial_review_due_at', 'editorial_gate_version', 'availability_status',
    'availability_verified_at', 'availability_review_due_at', 'primary_activity_type',
    'human_curation_status', 'human_curation_reviewed_at', 'human_curation_gate_version',
    'verified_at',
  ]
  const missingString = requiredStrings.some((field) => typeof row?.[field] !== 'string' || !row[field].trim())
  const invalidNumber = [
    row?.typical_spend_per_person,
    row?.recommended_duration_minutes,
    row?.latitude,
    row?.longitude,
    row?.editorial_score,
  ].some((value) => numberValue(value) == null)
  const invalidEligibility = row?.dataset_kind !== 'production'
    || row?.dataset_version !== PRODUCTION_DATASET_VERSION
    || row?.meeting_area !== meetingArea
    || row?.operational_eligible !== true
    || row?.editorial_eligible !== true
    || row?.human_curation_eligible !== true
    || row?.recommendation_eligible !== true
    || row?.alternative_recommendation_eligible !== true
    || row?.status !== 'active'
    || typeof row?.booking_required !== 'boolean'
    || typeof row?.car_required !== 'boolean'
    || !['keep_primary', 'alternative_only'].includes(row?.human_curation_status)
  const invalidArrays = !Array.isArray(row?.secondary_activity_types)
    || !Array.isArray(row?.editorial_evidence_refs)
    || row.editorial_evidence_refs.length === 0

  if (missingString || invalidNumber || invalidEligibility || invalidArrays) {
    throw new CatalogUnavailableError('Production Couple catalog returned an invalid row.')
  }
}

export function mapCatalogRowToConsensusPlace(row, meetingArea = row?.meeting_area) {
  assertCatalogRow(row, meetingArea)
  return {
    id: row.source_key,
    recommendationItemId: row.id,
    name: row.canonical_name,
    description: row.summary,
    area: MEETING_AREA_LABELS[row.meeting_area] || row.meeting_area,
    meetingArea: row.meeting_area,
    datasetKind: row.dataset_kind,
    datasetVersion: row.dataset_version,
    venueStatus: 'active',
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    freshnessClass: row.freshness_class,
    freshnessExpiresAt: row.freshness_expires_at,
    freshnessReviewDueAt: row.freshness_review_due_at,
    bookingRequired: row.booking_required,
    bookingUrl: row.booking_url,
    bookingOpenAt: row.booking_open_at,
    bookingCloseAt: row.booking_close_at,
    availabilityStatus: row.availability_status,
    availabilityVerifiedAt: row.availability_verified_at,
    availabilityReviewDueAt: row.availability_review_due_at,
    curationOrigin: row.curation_origin,
    editorialTier: row.editorial_tier,
    editorialScore: numberValue(row.editorial_score),
    editorialRationale: row.editorial_rationale,
    editorialReviewedAt: row.editorial_reviewed_at,
    editorialReviewDueAt: row.editorial_review_due_at,
    editorialEvidenceRefs: row.editorial_evidence_refs,
    editorialGateVersion: row.editorial_gate_version,
    humanCurationStatus: row.human_curation_status,
    humanCurationReviewedAt: row.human_curation_reviewed_at,
    humanCurationGateVersion: row.human_curation_gate_version,
    category: row.category,
    activityType: row.primary_activity_type,
    primaryActivityType: row.primary_activity_type,
    secondaryActivityTypes: row.secondary_activity_types,
    energy: row.energy_level,
    novelty: row.effective_novelty_level,
    budgetPerPerson: numberValue(row.typical_spend_per_person),
    durationMinutes: numberValue(row.recommended_duration_minutes),
    indoorOutdoor: row.indoor_outdoor,
    walkingLevel: row.walking_level,
    waitRisk: row.wait_risk,
    carRequired: row.car_required,
    mobilityScore: numberValue(row.mobility_score),
    verifiedAt: row.verified_at,
    address: row.address,
    latitude: numberValue(row.latitude),
    longitude: numberValue(row.longitude),
    kakaoPlaceId: row.kakao_place_id,
    kakaoPlaceName: row.venue_name,
    kakaoPlaceUrl: row.kakao_detail_url,
  }
}

export async function loadProductionCatalogPlaces(serviceClient, meetingArea) {
  if (!serviceClient?.from || !MEETING_AREA_LABELS[meetingArea]) {
    throw new CatalogUnavailableError('Production Couple catalog client or meeting area is invalid.')
  }

  let response
  try {
    response = await serviceClient
      .from('couple_recommendation_catalog')
      .select(CATALOG_SELECT_COLUMNS)
      .eq('dataset_kind', 'production')
      .eq('dataset_version', PRODUCTION_DATASET_VERSION)
      .eq('meeting_area', meetingArea)
      .eq('recommendation_eligible', true)
      .eq('alternative_recommendation_eligible', true)
      .order('source_key', { ascending: true })
  } catch (error) {
    throw new CatalogUnavailableError(undefined, error)
  }

  if (response?.error || !Array.isArray(response?.data) || response.data.length === 0) {
    throw new CatalogUnavailableError(undefined, response?.error)
  }

  try {
    return response.data.map((row) => mapCatalogRowToConsensusPlace(row, meetingArea))
  } catch (error) {
    if (error?.code === 'CATALOG_UNAVAILABLE') throw error
    throw new CatalogUnavailableError(undefined, error)
  }
}

export async function loadCouplePlaces({ source, meetingArea, serviceClient }) {
  const resolvedSource = resolveCouplePlaceSource(source)
  if (resolvedSource === COUPLE_PLACE_SOURCES.fixture) {
    return {
      source: resolvedSource,
      datasetVersion: FIXTURE_DATASET_VERSION,
      places: getFixturePlaces(meetingArea),
    }
  }

  return {
    source: resolvedSource,
    datasetVersion: PRODUCTION_DATASET_VERSION,
    places: await loadProductionCatalogPlaces(serviceClient, meetingArea),
  }
}

export function sanitizePlaceSnapshot(place) {
  return Object.fromEntries(
    PUBLIC_PLACE_FIELDS
      .filter((field) => place?.[field] !== undefined)
      .map((field) => [field, place[field]]),
  )
}

export function prepareConsensusResultForPersistence(result, { datasetVersion, algorithmVersion }) {
  return {
    status: result.status,
    agreementScore: result.agreementScore,
    sharedPoints: result.sharedPoints,
    differencePoints: result.differencePoints,
    compromiseText: result.compromiseText,
    datasetVersion,
    algorithmVersion,
    items: (result.items || []).map((item) => ({
      rank: item.rank,
      placeId: item.placeId,
      score: item.score,
      reason: item.reason,
      recommendationItemId: item.place?.recommendationItemId || null,
      place: sanitizePlaceSnapshot(item.place),
    })),
  }
}

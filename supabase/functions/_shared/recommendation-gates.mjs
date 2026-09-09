import { FIXTURE_DATASET_VERSION } from './couple-fixtures.mjs'

const PRIMARY_STANDARD_SCORE = 70
const ALTERNATIVE_TIERS = new Set(['hero', 'standard', 'coverage'])
const AVAILABLE_STATUSES = new Set(['available', 'limited', 'walk_in_only'])
const BLOCKED_AVAILABILITY_STATUSES = new Set(['sold_out', 'registration_closed', 'unknown'])
const HUMAN_CURATION_STATUSES = new Set(['keep_primary', 'alternative_only'])
const LEGACY_EDITORIAL_ONLY_DATASETS = new Set(['couple-production-pilot-v1'])

function time(value) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function isWithinWindow(place, at) {
  const validFrom = time(place.validFrom)
  const validUntil = time(place.validUntil)
  return (validFrom == null || validFrom <= at)
    && (validUntil == null || validUntil > at)
}

function evaluateFixtureOperationalGate(place, at) {
  const reasons = []
  if (place.status !== 'active') reasons.push('item_inactive')
  if (place.datasetVersion !== FIXTURE_DATASET_VERSION) reasons.push('fixture_version_mismatch')
  if (!isWithinWindow(place, at)) reasons.push('outside_valid_window')
  return { eligible: reasons.length === 0, reasons }
}

export function evaluateOperationalAvailabilityGate(place, now = new Date()) {
  const at = now.getTime()
  if (Number.isNaN(at)) throw new Error('유효한 추천 기준 시각이 필요합니다.')

  if (place.datasetKind === 'fixture') return evaluateFixtureOperationalGate(place, at)

  const reasons = []
  if (place.datasetKind !== 'production') reasons.push('unsupported_dataset_kind')
  if (place.venueStatus !== 'active') reasons.push('venue_inactive')
  if (place.status !== 'active') reasons.push('item_inactive')
  if (!isWithinWindow(place, at)) reasons.push('outside_valid_window')

  const freshnessExpiry = time(place.freshnessExpiresAt)
  if (place.freshnessClass === 'temporary' && (freshnessExpiry == null || freshnessExpiry <= at)) {
    reasons.push('temporary_expired')
  }
  const availabilityReviewDue = time(place.availabilityReviewDueAt)
  if (time(place.availabilityVerifiedAt) == null || availabilityReviewDue == null || availabilityReviewDue <= at) {
    reasons.push('availability_review_overdue')
  }
  if (!AVAILABLE_STATUSES.has(place.availabilityStatus)) {
    reasons.push(BLOCKED_AVAILABILITY_STATUSES.has(place.availabilityStatus)
      ? `availability_${place.availabilityStatus}`
      : 'availability_invalid')
  }
  if (place.bookingRequired && !place.bookingUrl) reasons.push('booking_url_missing')

  const bookingOpenAt = time(place.bookingOpenAt)
  const bookingCloseAt = time(place.bookingCloseAt)
  if (place.bookingRequired && bookingOpenAt != null && bookingOpenAt > at) reasons.push('booking_not_open')
  if (place.bookingRequired && bookingCloseAt != null && bookingCloseAt <= at) reasons.push('booking_closed')

  return { eligible: reasons.length === 0, reasons }
}

export function evaluateEditorialGate(place, now = new Date()) {
  if (place.datasetKind === 'fixture') return { eligible: true, reasons: [] }

  const at = now.getTime()
  const reasons = []
  if (place.curationOrigin !== 'independent_couple_research') reasons.push('curation_origin_invalid')
  if (!place.editorialGateVersion) reasons.push('editorial_gate_version_missing')
  if (!Number.isFinite(place.editorialScore)) reasons.push('editorial_score_missing')
  if (!ALTERNATIVE_TIERS.has(place.editorialTier)) reasons.push('editorial_tier_ineligible')
  if (!place.editorialRationale) reasons.push('editorial_rationale_missing')
  if (!Array.isArray(place.editorialEvidenceRefs) || place.editorialEvidenceRefs.length === 0) {
    reasons.push('editorial_evidence_missing')
  }
  const reviewedAt = time(place.editorialReviewedAt)
  const reviewDueAt = time(place.editorialReviewDueAt)
  if (reviewedAt == null || reviewDueAt == null || reviewDueAt <= reviewedAt || reviewDueAt <= at) {
    reasons.push('editorial_review_overdue')
  }
  return { eligible: reasons.length === 0, reasons }
}

export function evaluateHumanCurationGate(place) {
  if (place.datasetKind === 'fixture' || LEGACY_EDITORIAL_ONLY_DATASETS.has(place.datasetVersion)) {
    return { eligible: true, reasons: [] }
  }

  const reasons = []
  if (place.humanCurationStatus === 'research_hold') reasons.push('human_curation_research_hold')
  else if (!HUMAN_CURATION_STATUSES.has(place.humanCurationStatus)) reasons.push('human_curation_status_invalid')
  if (!time(place.humanCurationReviewedAt)) reasons.push('human_curation_review_missing')
  if (!place.humanCurationGateVersion) reasons.push('human_curation_gate_version_missing')
  return { eligible: reasons.length === 0, reasons }
}

export function isPrimaryRecommendationEligible(place) {
  if (place.datasetKind === 'fixture') return true
  const editorialPrimary = place.editorialTier === 'hero'
    || (place.editorialTier === 'standard' && place.editorialScore >= PRIMARY_STANDARD_SCORE)
  if (LEGACY_EDITORIAL_ONLY_DATASETS.has(place.datasetVersion)) return editorialPrimary
  return editorialPrimary && place.humanCurationStatus === 'keep_primary'
}

export function evaluateRecommendationGates(place, now = new Date()) {
  const operational = evaluateOperationalAvailabilityGate(place, now)
  if (!operational.eligible) {
    return {
      operationalEligible: false,
      editorialEligible: false,
      humanCurationEligible: false,
      alternativeEligible: false,
      primaryEligible: false,
      reasons: operational.reasons,
    }
  }

  const editorial = evaluateEditorialGate(place, now)
  if (!editorial.eligible) {
    return {
      operationalEligible: true,
      editorialEligible: false,
      humanCurationEligible: false,
      alternativeEligible: false,
      primaryEligible: false,
      reasons: editorial.reasons,
    }
  }

  const humanCuration = evaluateHumanCurationGate(place)
  return {
    operationalEligible: true,
    editorialEligible: true,
    humanCurationEligible: humanCuration.eligible,
    alternativeEligible: humanCuration.eligible,
    primaryEligible: humanCuration.eligible && isPrimaryRecommendationEligible(place),
    reasons: humanCuration.reasons,
  }
}

export const recommendationGateConfig = Object.freeze({
  primaryStandardScore: PRIMARY_STANDARD_SCORE,
  alternativeTiers: [...ALTERNATIVE_TIERS],
  availableStatuses: [...AVAILABLE_STATUSES],
  humanCurationStatuses: [...HUMAN_CURATION_STATUSES],
})

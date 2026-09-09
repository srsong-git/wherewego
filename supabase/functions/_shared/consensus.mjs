import {
  evaluateEditorialGate,
  evaluateHumanCurationGate,
  evaluateOperationalAvailabilityGate,
  isPrimaryRecommendationEligible,
} from './recommendation-gates.mjs'

export const CONSENSUS_ALGORITHM_VERSION = 'consensus-v1.1'
export const ALTERNATIVE_DIVERSITY_MAX_SCORE_DELTA = 5

const activityLabels = {
  cafe: '카페',
  exhibition_popup: '전시·팝업',
  experience: '체험·놀거리',
  walk_culture: '산책·문화공간',
  any: '활동은 아무거나',
}
const energyLabels = { low: '쉬고 싶음', medium: '적당히 움직이기', high: '활동적으로 보내기' }
const noveltyLabels = { proven: '검증된 곳', balanced: '적당히 새로운 곳', new: '신상·특별한 곳' }
const budgetLabels = { under_20000: '1인 2만원 이하', under_40000: '1인 4만원 이하', any: '예산 상관없음' }
const durationLabels = { 120: '1~2시간', 240: '3~4시간', unlimited: '시간 넉넉함' }
const vetoLabels = {
  outdoor: '야외는 피하기',
  long_walk: '많이 걷지 않기',
  long_wait: '긴 웨이팅 피하기',
  cafe: '카페 제외',
  high_cost: '비싼 곳 제외',
  car_required: '자동차가 필요한 곳 제외',
}

const energyIndex = { low: 0, medium: 1, high: 2 }
const noveltyIndex = { proven: 0, balanced: 1, new: 2 }

function budgetLimit(value) {
  return value === 'under_20000' ? 20000 : value === 'under_40000' ? 40000 : Infinity
}

function durationLimit(value) {
  return value === '120' ? 120 : value === '240' ? 240 : Infinity
}

function activityScore(answer, placeType) {
  if (answer === 'any' || answer === placeType) return 35
  const compatible = new Set([
    'exhibition_popup:experience',
    'experience:exhibition_popup',
    'exhibition_popup:walk_culture',
    'walk_culture:exhibition_popup',
    'cafe:walk_culture',
    'walk_culture:cafe',
  ])
  return compatible.has(`${answer}:${placeType}`) ? 18 : 6
}

function ordinalScore(answer, actual, index, maximum) {
  const difference = Math.abs(index[answer] - index[actual])
  return difference === 0 ? maximum : difference === 1 ? maximum * 0.58 : maximum * 0.2
}

function budgetScore(answer, cost) {
  if (answer === 'any') return 12
  if (answer === 'under_20000') return cost <= 10000 ? 12 : 10
  return cost <= 20000 ? 12 : 9
}

function durationScore(answer, minutes) {
  if (answer === 'unlimited') return 13
  const limit = durationLimit(answer)
  return minutes <= limit * 0.75 ? 13 : 11
}

function violatesVeto(place, veto) {
  if (veto === 'outdoor') return place.indoorOutdoor === 'outdoor'
  if (veto === 'long_walk') return place.walkingLevel === 'high'
  if (veto === 'long_wait') return place.waitRisk === 'high'
  // "카페 제외"는 카페가 주목적인 Item만 제외합니다. 복합문화공간의
  // 보조 카페 경험까지 함께 제거하지 않도록 legacy fixture에서는
  // activityType을, production Item에서는 primaryActivityType을 사용합니다.
  if (veto === 'cafe') return (place.primaryActivityType || place.activityType) === 'cafe'
  if (veto === 'high_cost') return place.budgetPerPerson > 20000
  if (veto === 'car_required') return place.carRequired
  return false
}

function selectAlternatives(ranked, primary, limit = 2) {
  const remaining = ranked.filter((candidate) => candidate !== primary)
  const selected = []
  const selectedCategories = new Set([primary.place.category])

  while (remaining.length && selected.length < limit) {
    const bestScore = remaining[0].score
    const comparable = remaining.filter(
      (candidate) => bestScore - candidate.score <= ALTERNATIVE_DIVERSITY_MAX_SCORE_DELTA,
    )
    const diverse = comparable.find((candidate) => !selectedCategories.has(candidate.place.category))
    const choice = diverse || remaining[0]
    selected.push(choice)
    selectedCategories.add(choice.place.category)
    remaining.splice(remaining.indexOf(choice), 1)
  }

  return selected
}

function scoreForParticipant(place, answer) {
  const mobility = Number.isFinite(place.mobilityScore)
    ? Math.max(0, Math.min(5, place.mobilityScore))
    : 2.5
  return activityScore(answer.activity, place.activityType)
    + ordinalScore(answer.energy, place.energy, energyIndex, 20)
    + ordinalScore(answer.novelty, place.novelty, noveltyIndex, 15)
    + budgetScore(answer.budget, place.budgetPerPerson)
    + durationScore(answer.duration, place.durationMinutes)
    + mobility
}

function similarity(left, right, index) {
  if (left === right) return 1
  if (!index) return left === 'any' || right === 'any' ? 0.75 : 0.25
  return 1 - Math.abs(index[left] - index[right]) / 2
}

function getAgreementScore(a, b) {
  const vetoA = new Set(a.vetoes || [])
  const vetoB = new Set(b.vetoes || [])
  const union = new Set([...vetoA, ...vetoB])
  const intersection = [...vetoA].filter((value) => vetoB.has(value)).length
  const vetoSimilarity = union.size ? intersection / union.size : 1
  const dimensions = [
    similarity(a.activity, b.activity),
    similarity(a.energy, b.energy, energyIndex),
    similarity(a.novelty, b.novelty, noveltyIndex),
    similarity(a.budget, b.budget, { under_20000: 0, under_40000: 1, any: 2 }),
    similarity(a.duration, b.duration, { 120: 0, 240: 1, unlimited: 2 }),
    vetoSimilarity,
  ]
  const raw = dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length * 100
  return Math.max(0, Math.min(100, Math.round(raw / 5) * 5))
}

function getSharedPoints(a, b) {
  const points = []
  if (a.activity === b.activity && a.activity !== 'any') points.push(`둘 다 ${activityLabels[a.activity]}을 원했어요`)
  if (a.energy === b.energy) points.push(`둘 다 ${energyLabels[a.energy]}를 원했어요`)
  if (a.novelty === b.novelty) points.push(`둘 다 ${noveltyLabels[a.novelty]}을 선호했어요`)
  if (a.budget === b.budget && a.budget !== 'any') points.push(`둘 다 ${budgetLabels[a.budget]}를 생각했어요`)
  const sharedVetoes = (a.vetoes || []).filter((value) => (b.vetoes || []).includes(value))
  sharedVetoes.forEach((value) => points.push(`둘 다 ${vetoLabels[value]}를 원했어요`))
  if (!points.length) points.push('둘 다 같은 권역에서 부담 없이 만나고 싶어 해요')
  return points.slice(0, 3)
}

function getDifferencePoints(a, b) {
  const points = []
  if (a.activity !== b.activity) points.push(`한 분은 ${activityLabels[a.activity]}, 다른 한 분은 ${activityLabels[b.activity]}을 골랐어요`)
  if (a.energy !== b.energy) points.push(`한 분은 ${energyLabels[a.energy]}, 다른 한 분은 ${energyLabels[b.energy]}를 원했어요`)
  if (a.novelty !== b.novelty) points.push(`한 분은 ${noveltyLabels[a.novelty]}, 다른 한 분은 ${noveltyLabels[b.novelty]}을 선호했어요`)
  if (a.budget !== b.budget) points.push(`예산은 ${budgetLabels[a.budget]}와 ${budgetLabels[b.budget]}로 달랐어요`)
  if (a.duration !== b.duration) points.push(`가능 시간은 ${durationLabels[a.duration]}와 ${durationLabels[b.duration]}로 달랐어요`)
  return points.slice(0, 2)
}

function recommendationReason(place, aScore, bScore, rank) {
  const balance = Math.abs(aScore - bScore) <= 12 ? '두 분의 만족도 차이가 작고' : '서로 다른 선택을 절충하면서'
  const lead = rank === 1 ? '오늘의 강력추천이에요.' : '다른 분위기를 원할 때 좋은 대안이에요.'
  return `${balance} ${activityLabels[place.activityType]} 취향에 잘 맞아요. ${lead}`
}

export function calculateConsensus({ meetingArea, answers, places, now = new Date() }) {
  if (!Array.isArray(answers) || answers.length !== 2) throw new Error('두 사람의 응답이 필요합니다.')
  const [a, b] = answers
  const vetoes = new Set([...(a.vetoes || []), ...(b.vetoes || [])])
  const strictBudget = Math.min(budgetLimit(a.budget), budgetLimit(b.budget))
  const strictDuration = Math.min(durationLimit(a.duration), durationLimit(b.duration))

  const ranked = places
    .filter((place) => place.meetingArea === meetingArea)
    // Editorial quality never changes the weighted score. These two filters
    // decide candidate eligibility before Preference hard filters and ranking.
    .filter((place) => evaluateOperationalAvailabilityGate(place, now).eligible)
    .filter((place) => evaluateEditorialGate(place, now).eligible)
    .filter((place) => evaluateHumanCurationGate(place).eligible)
    .filter((place) => place.budgetPerPerson <= strictBudget)
    .filter((place) => place.durationMinutes <= strictDuration)
    .filter((place) => [...vetoes].every((veto) => !violatesVeto(place, veto)))
    .map((place) => {
      const aScore = scoreForParticipant(place, a)
      const bScore = scoreForParticipant(place, b)
      const minimum = Math.min(aScore, bScore)
      const average = (aScore + bScore) / 2
      return { place, aScore, bScore, score: minimum * 0.7 + average * 0.3 }
    })
    .sort((left, right) => right.score - left.score
      || new Date(right.place.verifiedAt).getTime() - new Date(left.place.verifiedAt).getTime()
      || right.place.mobilityScore - left.place.mobilityScore
      || left.place.id.localeCompare(right.place.id))

  const agreementScore = getAgreementScore(a, b)
  const sharedPoints = getSharedPoints(a, b)
  const differencePoints = getDifferencePoints(a, b)

  const primary = ranked.find((candidate) => isPrimaryRecommendationEligible(candidate.place))

  if (!primary) {
    return {
      status: 'no_match',
      agreementScore,
      sharedPoints,
      differencePoints,
      compromiseText: '두 분의 절대 조건과 현실 조건을 모두 지키는 추천 장소가 없어요. 조건을 몰래 완화하지 않고 새 방에서 다시 고를 수 있게 했어요.',
      items: [],
    }
  }

  const selected = [primary, ...selectAlternatives(ranked, primary)]

  return {
    status: 'ready',
    agreementScore,
    sharedPoints,
    differencePoints,
    compromiseText: `${selected[0].place.name}은(는) 두 분 중 한쪽에만 치우치지 않으면서 예산·시간·절대 제외 조건을 모두 지킨 절충안이에요.`,
    items: selected.slice(0, 3).map((candidate, index) => ({
      rank: index + 1,
      placeId: candidate.place.id,
      score: Number(candidate.score.toFixed(2)),
      reason: recommendationReason(candidate.place, candidate.aScore, candidate.bScore, index + 1),
      place: candidate.place,
    })),
  }
}

// Internal quality harness only. This exposes counts around the existing gate
// pipeline without changing eligibility, scoring, sorting, or selection.
export function diagnoseConsensusPipeline({ meetingArea, answers, places, now = new Date() }) {
  if (!Array.isArray(answers) || answers.length !== 2) throw new Error('두 사람의 응답이 필요합니다.')
  const [a, b] = answers
  const vetoes = new Set([...(a.vetoes || []), ...(b.vetoes || [])])
  const strictBudget = Math.min(budgetLimit(a.budget), budgetLimit(b.budget))
  const strictDuration = Math.min(durationLimit(a.duration), durationLimit(b.duration))

  const areaCandidates = places.filter((place) => place.meetingArea === meetingArea)
  const operationalCandidates = areaCandidates.filter(
    (place) => evaluateOperationalAvailabilityGate(place, now).eligible,
  )
  const editorialCandidates = operationalCandidates.filter(
    (place) => evaluateEditorialGate(place, now).eligible,
  )
  const humanCurationCandidates = editorialCandidates.filter(
    (place) => evaluateHumanCurationGate(place).eligible,
  )
  const hardFilterCandidates = humanCurationCandidates
    .filter((place) => place.budgetPerPerson <= strictBudget)
    .filter((place) => place.durationMinutes <= strictDuration)
    .filter((place) => [...vetoes].every((veto) => !violatesVeto(place, veto)))

  const result = calculateConsensus({ meetingArea, answers, places, now })
  const candidatesById = new Map(hardFilterCandidates.map((place) => [place.id, place]))

  return {
    ...result,
    counts: {
      areaCandidates: areaCandidates.length,
      operationalAvailabilityPassed: operationalCandidates.length,
      editorialPassed: editorialCandidates.length,
      humanCurationPassed: humanCurationCandidates.length,
      hardFilterPassed: hardFilterCandidates.length,
      primaryEligibleAfterHardFilter: hardFilterCandidates.filter(isPrimaryRecommendationEligible).length,
    },
    items: result.items.map((item) => {
      const place = candidatesById.get(item.placeId) || item.place
      return {
        ...item,
        aSatisfaction: Number(scoreForParticipant(place, a).toFixed(2)),
        bSatisfaction: Number(scoreForParticipant(place, b).toFixed(2)),
        editorialTier: place.editorialTier,
        editorialScore: place.editorialScore,
        humanCurationStatus: place.humanCurationStatus,
        primaryEligible: isPrimaryRecommendationEligible(place),
      }
    }),
  }
}

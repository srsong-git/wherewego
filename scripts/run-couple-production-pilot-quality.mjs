import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagnoseConsensusPipeline } from '../supabase/functions/_shared/consensus.mjs'
import {
  evaluateRecommendationGates,
  isPrimaryRecommendationEligible,
} from '../supabase/functions/_shared/recommendation-gates.mjs'
import {
  buildConsensusPlaces,
  buildCoverageReport,
  loadPlacePool,
  validatePlacePool,
} from './import-couple-place-pool.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCENARIO_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b1', 'quality-scenarios.json')
const REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b1-6-quality.json')
const REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b1-6-quality.md')
const AREAS = new Set(['seongsu', 'hongdae', 'jongno_euljiro'])
const ACTIVITIES = new Set(['cafe', 'exhibition_popup', 'experience', 'walk_culture', 'any'])
const ENERGIES = new Set(['low', 'medium', 'high'])
const NOVELTIES = new Set(['proven', 'balanced', 'new'])
const BUDGETS = new Set(['under_20000', 'under_40000', 'any'])
const DURATIONS = new Set(['120', '240', 'unlimited'])
const VETOES = new Set(['outdoor', 'long_walk', 'long_wait', 'cafe', 'high_cost', 'car_required'])

const labels = {
  areas: { seongsu: '성수·서울숲', hongdae: '홍대·연남', jongno_euljiro: '종로·을지로' },
  activity: { cafe: '카페', exhibition_popup: '전시·팝업', experience: '체험', walk_culture: '산책·문화', any: '아무거나' },
  energy: { low: '낮음', medium: '보통', high: '높음' },
  novelty: { proven: '검증', balanced: '균형', new: '신상' },
  budget: { under_20000: '≤2만', under_40000: '≤4만', any: '무관' },
  duration: { 120: '1~2h', 240: '3~4h', unlimited: '넉넉' },
  veto: { outdoor: '야외', long_walk: '많이 걷기', long_wait: '긴 대기', cafe: '카페', high_cost: '고비용', car_required: '차량' },
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function validateAnswer(answer, label) {
  assert(ACTIVITIES.has(answer?.activity), `${label}.activity가 잘못됐습니다.`)
  assert(ENERGIES.has(answer?.energy), `${label}.energy가 잘못됐습니다.`)
  assert(NOVELTIES.has(answer?.novelty), `${label}.novelty가 잘못됐습니다.`)
  assert(BUDGETS.has(answer?.budget), `${label}.budget이 잘못됐습니다.`)
  assert(DURATIONS.has(answer?.duration), `${label}.duration이 잘못됐습니다.`)
  assert(Array.isArray(answer?.vetoes) && answer.vetoes.length <= 2, `${label}.vetoes는 최대 2개여야 합니다.`)
  assert(answer.vetoes.every((veto) => VETOES.has(veto)), `${label}.vetoes가 잘못됐습니다.`)
}

export function loadScenarios(scenarioPath = SCENARIO_PATH, expectedDatasetVersion = 'couple-production-pilot-v1') {
  const file = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))
  assert(file.dataset_version === expectedDatasetVersion, `시나리오 dataset_version은 ${expectedDatasetVersion}이어야 합니다.`)
  assert(Array.isArray(file.scenarios) && file.scenarios.length >= 15, '대표 시나리오는 15개 이상이어야 합니다.')
  const ids = new Set()
  for (const scenario of file.scenarios) {
    assert(!ids.has(scenario.id), `시나리오 ID가 중복됩니다: ${scenario.id}`)
    ids.add(scenario.id)
    assert(AREAS.has(scenario.meeting_area), `${scenario.id}.meeting_area가 잘못됐습니다.`)
    validateAnswer(scenario.a, `${scenario.id}.A`)
    validateAnswer(scenario.b, `${scenario.id}.B`)
  }
  assert([...AREAS].every((area) => file.scenarios.some((scenario) => scenario.meeting_area === area)), '세 권역이 모두 포함되어야 합니다.')
  return file
}

function compactAnswer(answer) {
  const veto = answer.vetoes.length ? answer.vetoes.map((value) => labels.veto[value]).join('+') : '없음'
  return `${labels.activity[answer.activity]}·${labels.energy[answer.energy]}·${labels.novelty[answer.novelty]}·${labels.budget[answer.budget]}·${labels.duration[answer.duration]}·veto:${veto}`
}

function describeResult(scenario, diagnosis) {
  if (diagnosis.status === 'no_match') {
    if (diagnosis.counts.hardFilterPassed === 0) {
      return 'Operational·Editorial·Human Curation Gate 통과 후보가 있었지만 예산·시간·veto 합집합 적용 뒤 후보가 남지 않았습니다.'
    }
    return `hard filter 뒤 ${diagnosis.counts.hardFilterPassed}개가 남았지만 모두 대안 전용 Tier라 강력추천으로 승격하지 않았습니다.`
  }
  const primary = diagnosis.items[0]
  const preference = primary.place
  return `${primary.editorialTier} ${preference.name}이(가) 1위 자격을 갖춘 후보 중 A ${primary.aSatisfaction.toFixed(1)}점·B ${primary.bSatisfaction.toFixed(1)}점으로 가장 균형 있게 평가됐습니다. 태그는 ${labels.activity[preference.activityType]}·에너지 ${labels.energy[preference.energy]}·${labels.novelty[preference.novelty]}입니다.`
}

function normalizeScenarioResult(scenario, diagnosis) {
  const primary = diagnosis.items[0] || null
  const alternatives = diagnosis.items.slice(1).map((item) => ({
    source_key: item.placeId,
    name: item.place.name,
    tier: item.editorialTier,
    human_curation_status: item.humanCurationStatus,
    score: item.score,
  }))
  return {
    id: scenario.id,
    title: scenario.title,
    meeting_area: scenario.meeting_area,
    a: scenario.a,
    b: scenario.b,
    a_compact: compactAnswer(scenario.a),
    b_compact: compactAnswer(scenario.b),
    counts: diagnosis.counts,
    status: diagnosis.status,
    agreement_score: diagnosis.agreementScore,
    primary: primary ? {
      source_key: primary.placeId,
      name: primary.place.name,
      tier: primary.editorialTier,
      editorial_score: primary.editorialScore,
      human_curation_status: primary.humanCurationStatus,
      category: primary.place.category,
      activity_type: primary.place.activityType,
      energy: primary.place.energy,
      novelty: primary.place.novelty,
      a_satisfaction: primary.aSatisfaction,
      b_satisfaction: primary.bSatisfaction,
      consensus_score: primary.score,
    } : null,
    alternatives,
    result_reason: describeResult(scenario, diagnosis),
    human_review: scenario.human_review || '내부 검토 대기',
    root_cause: scenario.root_cause || '검토 대기',
  }
}

function countPrimaries(results) {
  const counts = new Map()
  for (const result of results) {
    if (!result.primary) continue
    counts.set(result.primary.name, (counts.get(result.primary.name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ko'))
}

function countPrimariesByArea(results) {
  return Object.fromEntries([...AREAS].map((area) => {
    const ready = results.filter((result) => result.meeting_area === area && result.primary)
    const counts = countPrimaries(ready)
    return [area, {
      ready_scenarios: ready.length,
      frequencies: counts.map((entry) => ({
        ...entry,
        share_percent: ready.length ? Number((entry.count / ready.length * 100).toFixed(1)) : 0,
      })),
    }]
  }))
}

function buildAssertions(places, results, asOf) {
  const selectedItems = results.flatMap((result) => [result.primary, ...result.alternatives]).filter(Boolean)
  const rejectedNames = new Set(places.filter((place) => place.editorialTier === 'reject').map((place) => place.name))
  const forbiddenAlternativePrimaries = new Set(
    places
      .filter((place) => place.editorialTier === 'coverage' || (place.editorialTier === 'standard' && place.editorialScore < 70))
      .map((place) => place.name),
  )
  const coverageOnly = results.find((result) => result.id === 'S13')
  return {
    reject_never_selected: !selectedItems.some((item) => rejectedNames.has(item.name)),
    coverage_never_primary: !results.some((result) => result.primary?.tier === 'coverage'),
    standard_65_69_never_primary: !results.some((result) => result.primary && forbiddenAlternativePrimaries.has(result.primary.name)),
    closed_najeon_never_selected: !selectedItems.some((item) => item.name === '나전함, 공예를 담다'),
    coverage_only_returns_no_match: coverageOnly?.status === 'no_match'
      && coverageOnly.counts.hardFilterPassed > 0
      && coverageOnly.counts.primaryEligibleAfterHardFilter === 0,
    eligible_pool_is_17: places.filter((place) => evaluateRecommendationGates(place, asOf).alternativeEligible).length === 17,
  }
}

export function renderMarkdown(report, title = 'Couple Phase 1B-1.6 Production Pilot Quality Report') {
  const lines = [
    `# ${title}`,
    '',
    `- Dataset: \`${report.dataset_version}\``,
    `- 기준 시각: ${report.as_of}`,
    `- 시나리오: ${report.scenarios.length}개`,
    `- 공개 \`/couple\` dataset 변경: 없음`,
    '',
    '## 시나리오 결과',
    '',
    '| ID | 권역·시나리오 | A 입력 | B 입력 | Op | Ed | Human | Hard | 강력추천 (A/B/Consensus) | 대안 1·2 (Tier) | 결과 이유 | 사람 검토 |',
    '|---|---|---|---|---:|---:|---:|---:|---|---|---|---|',
  ]
  for (const result of report.scenarios) {
    const primary = result.primary
      ? `${result.primary.name} (${result.primary.tier}, ${result.primary.a_satisfaction}/${result.primary.b_satisfaction}/${result.primary.consensus_score})`
      : 'no_match'
    const alternatives = result.alternatives.length
      ? result.alternatives.map((item) => `${item.name} (${item.tier})`).join('<br>')
      : '-'
    lines.push(`| ${result.id} | ${labels.areas[result.meeting_area]}<br>${result.title} | ${result.a_compact} | ${result.b_compact} | ${result.counts.operationalAvailabilityPassed} | ${result.counts.editorialPassed} | ${result.counts.humanCurationPassed ?? result.counts.editorialPassed} | ${result.counts.hardFilterPassed} | ${primary} | ${alternatives} | ${result.result_reason} | ${result.human_review}<br>원인: ${result.root_cause} |`)
  }
  lines.push(
    '',
    '## 반복 추천',
    '',
    ...report.analysis.primary_frequency.map((entry) => `- ${entry.name}: ${entry.count}회`),
    '',
    '## 권역별 강력추천 가능 pool',
    '',
    ...Object.entries(report.analysis.primary_pool_by_area).map(([area, count]) => `- ${labels.areas[area]}: ${count}개`),
    '',
    '## 권역별 1위 집중도',
    '',
    ...Object.entries(report.analysis.primary_frequency_by_area).map(([area, value]) => `- ${labels.areas[area]}: ${value.frequencies.map((entry) => `${entry.name} ${entry.count}/${value.ready_scenarios} (${entry.share_percent}%)`).join(', ')}`),
    '',
    `- no_match: ${report.analysis.no_match_scenarios.length ? report.analysis.no_match_scenarios.join(', ') : '없음'}`,
    `- Coverage gap: ${Object.entries(report.analysis.coverage_gaps).map(([area, gaps]) => `${labels.areas[area]}=${gaps.join(', ') || '없음'}`).join(' / ')}`,
    '',
    '## Gate assertions',
    '',
    ...Object.entries(report.assertions).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'} — ${name}`),
    '',
  )
  return `${lines.join('\n')}\n`
}

export function runQualityHarness(options = {}) {
  const pool = options.pool || loadPlacePool()
  const scenarioFile = options.scenarioFile || loadScenarios()
  const validation = validatePlacePool(pool)
  assert(validation.ok, `Place Pool validation 실패:\n${validation.errors.join('\n')}`)
  assert(pool.dataset_version === scenarioFile.dataset_version, '시나리오와 Place Pool dataset_version이 다릅니다.')
  const asOf = new Date(scenarioFile.as_of)
  assert(!Number.isNaN(asOf.getTime()), '시나리오 기준 시각이 잘못됐습니다.')
  const places = buildConsensusPlaces(pool)
  const scenarios = scenarioFile.scenarios.map((scenario) => normalizeScenarioResult(
    scenario,
    diagnoseConsensusPipeline({
      meetingArea: scenario.meeting_area,
      answers: [scenario.a, scenario.b],
      places,
      now: asOf,
    }),
  ))
  const coverage = buildCoverageReport(pool, asOf)
  const eligiblePlaces = places.filter((place) => evaluateRecommendationGates(place, asOf).alternativeEligible)
  const primaryPoolByArea = Object.fromEntries([...AREAS].map((area) => [
    area,
    eligiblePlaces.filter((place) => place.meetingArea === area && isPrimaryRecommendationEligible(place)).length,
  ]))
  return {
    dataset_version: pool.dataset_version,
    as_of: asOf.toISOString(),
    public_dataset_changed: false,
    totals: {
      venues: pool.venues.length,
      items: pool.items.length,
      eligible_items: eligiblePlaces.length,
      scenarios: scenarios.length,
    },
    scenarios,
    analysis: {
      primary_frequency: countPrimaries(scenarios),
      primary_frequency_by_area: countPrimariesByArea(scenarios),
      primary_pool_by_area: primaryPoolByArea,
      no_match_scenarios: scenarios.filter((scenario) => scenario.status === 'no_match').map((scenario) => scenario.id),
      coverage_gaps: Object.fromEntries(Object.entries(coverage.areas).map(([area, value]) => [area, value.gaps])),
    },
    assertions: options.assertionBuilder
      ? options.assertionBuilder({ places, scenarios, asOf, coverage, eligiblePlaces })
      : buildAssertions(places, scenarios, asOf),
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const report = runQualityHarness()
  const assertionsPassed = Object.values(report.assertions).every(Boolean)
  console.log(`Production pilot quality — ${report.scenarios.length} scenarios, eligible ${report.totals.eligible_items}, no_match ${report.analysis.no_match_scenarios.length}`)
  console.log(`Gate assertions — ${assertionsPassed ? 'PASS' : 'FAIL'}`)
  if (process.argv.includes('--write-report')) {
    fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true })
    fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
    fs.writeFileSync(REPORT_MARKDOWN_PATH, renderMarkdown(report))
    console.log(`WROTE ${path.relative(ROOT_DIR, REPORT_JSON_PATH)}`)
    console.log(`WROTE ${path.relative(ROOT_DIR, REPORT_MARKDOWN_PATH)}`)
  }
  if (!assertionsPassed) process.exitCode = 1
}

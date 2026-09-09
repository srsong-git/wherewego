import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagnoseConsensusPipeline } from '../supabase/functions/_shared/consensus.mjs'
import { evaluateRecommendationGates, isPrimaryRecommendationEligible } from '../supabase/functions/_shared/recommendation-gates.mjs'
import { loadPhase1B2APlacePool } from './import-couple-place-pool.mjs'
import { loadScenarios, renderMarkdown, runQualityHarness } from './run-couple-production-pilot-quality.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE_SCENARIO_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b1', 'quality-scenarios.json')
const NEW_SCENARIO_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b2a', 'quality-scenarios.json')
const REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-quality.json')
const REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-quality.md')
const AREAS = ['seongsu', 'hongdae', 'jongno_euljiro']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function loadCombinedScenarios() {
  const base = loadScenarios(BASE_SCENARIO_PATH, 'couple-production-pilot-v1')
  const additional = JSON.parse(fs.readFileSync(NEW_SCENARIO_PATH, 'utf8'))
  assert(additional.dataset_version === 'couple-production-phase1b2a-v1', '1B-2A scenario dataset_version이 잘못됐습니다.')
  assert(Array.isArray(additional.scenarios) && additional.scenarios.length >= 6, '1B-2A 신규 시나리오가 부족합니다.')
  const scenarios = [...base.scenarios, ...additional.scenarios].map((scenario) => ({
    ...scenario,
    human_review: undefined,
    root_cause: undefined,
  }))
  assert(new Set(scenarios.map((scenario) => scenario.id)).size === scenarios.length, '통합 시나리오 ID가 중복됩니다.')
  return {
    dataset_version: additional.dataset_version,
    as_of: additional.as_of,
    scenarios,
  }
}

function buildExpandedAssertions({ places, scenarios, asOf, coverage, eligiblePlaces }) {
  const selectedNames = new Set(scenarios.flatMap((result) => [
    result.primary?.name,
    ...result.alternatives.map((item) => item.name),
  ]).filter(Boolean))
  const rejectedNames = new Set(places.filter((place) => place.editorialTier === 'reject').map((place) => place.name))
  const researchHoldNames = new Set(places.filter((place) => place.humanCurationStatus === 'research_hold').map((place) => place.name))
  const coverageCandidate = places.find((place) => place.editorialTier === 'coverage'
    && evaluateRecommendationGates(place, asOf).alternativeEligible)
  const coverageOnly = diagnoseConsensusPipeline({
    meetingArea: coverageCandidate.meetingArea,
    answers: [
      { activity: 'any', energy: coverageCandidate.energy, novelty: coverageCandidate.novelty, budget: 'any', duration: 'unlimited', vetoes: [] },
      { activity: 'any', energy: coverageCandidate.energy, novelty: coverageCandidate.novelty, budget: 'any', duration: 'unlimited', vetoes: [] },
    ],
    places: [coverageCandidate],
    now: asOf,
  })
  return {
    human_curated_recommendable_pool_is_58: eligiblePlaces.length === 58,
    human_curated_area_counts_are_20_19_19: coverage.areas.seongsu.eligible_item_count === 20
      && coverage.areas.hongdae.eligible_item_count === 19
      && coverage.areas.jongno_euljiro.eligible_item_count === 19,
    reject_never_selected: ![...selectedNames].some((name) => rejectedNames.has(name)),
    research_hold_never_selected: ![...selectedNames].some((name) => researchHoldNames.has(name)),
    only_keep_primary_selected_first: scenarios.every((result) => !result.primary
      || result.primary.human_curation_status === 'keep_primary'),
    coverage_never_primary: !scenarios.some((result) => result.primary?.tier === 'coverage'),
    standard_65_69_never_primary: !scenarios.some((result) => result.primary?.tier === 'standard' && result.primary.editorial_score < 70),
    closed_najeon_never_selected: !selectedNames.has('나전함, 공예를 담다'),
    coverage_only_returns_no_match: coverageOnly.status === 'no_match'
      && coverageOnly.counts.hardFilterPassed === 1
      && coverageOnly.counts.primaryEligibleAfterHardFilter === 0,
    every_area_has_multiple_primary_candidates: AREAS.every((area) => eligiblePlaces.filter(
      (place) => place.meetingArea === area && isPrimaryRecommendationEligible(place),
    ).length >= 5),
  }
}

function addHumanReview(report) {
  return {
    ...report,
    scenarios: report.scenarios.map((scenario) => {
      if (!scenario.primary) {
        return {
          ...scenario,
          human_review: '검토 필요. 조건을 완화하지 않는 원칙 때문에 no_match가 발생했으며 후보 구성 또는 태깅 원인을 확인해야 합니다.',
          root_cause: scenario.counts.hardFilterPassed === 0 ? 'Preference hard filter 또는 veto' : '강력추천 자격 후보 부족',
        }
      }
      const minSatisfaction = Math.min(scenario.primary.a_satisfaction, scenario.primary.b_satisfaction)
      const sharedActivity = scenario.a.activity === scenario.b.activity && scenario.a.activity !== 'any'
        ? scenario.a.activity
        : null
      const activityMiss = sharedActivity && scenario.primary.activity_type !== sharedActivity
      let humanReview = '설득력 높음. 두 사람의 핵심 조건과 강력추천 자격을 함께 만족하는 후보입니다.'
      let rootCause = '정상 결과'
      if (activityMiss) {
        humanReview = `설득력 낮음. 둘 다 ${sharedActivity}을 원했지만 1위의 주 활동이 ${scenario.primary.activity_type}입니다.`
        rootCause = '해당 활동 유형의 강력추천 자격 또는 hard-filter 통과 후보 부족'
      } else if (minSatisfaction < 60) {
        humanReview = '설득력 낮음. 더 불리한 사람의 만족도가 60점 미만이라 실제 선택으로 이어질 가능성을 추가 검토해야 합니다.'
        rootCause = '상반된 입력 또는 Preference Coverage 부족'
      } else if (minSatisfaction < 80) {
        humanReview = '설득력 보통. 핵심 조건은 지키지만 한쪽 만족도가 낮아 후보 다양성을 더 보강할 여지가 있습니다.'
        rootCause = '부분적 Preference Coverage 부족'
      }
      return { ...scenario, human_review: humanReview, root_cause: rootCause }
    }),
  }
}

export function runPhase1B2AQualityHarness(options = {}) {
  const loadedPool = loadPhase1B2APlacePool()
  const pool = options.humanGateMode === 'before'
    ? {
      ...loadedPool,
      items: loadedPool.items.map((item) => ({ ...item, human_curation_status: 'keep_primary' })),
    }
    : loadedPool
  const rawReport = runQualityHarness({
    pool,
    scenarioFile: loadCombinedScenarios(),
    assertionBuilder: options.humanGateMode === 'before'
      ? () => ({ legacy_editorial_only_baseline_captured: true })
      : buildExpandedAssertions,
  })
  return addHumanReview(rawReport)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const report = runPhase1B2AQualityHarness()
  const assertionsPassed = Object.values(report.assertions).every(Boolean)
  console.log(`Phase 1B-2A quality — ${report.scenarios.length} scenarios, eligible ${report.totals.eligible_items}, no_match ${report.analysis.no_match_scenarios.length}`)
  console.log(`Gate assertions — ${assertionsPassed ? 'PASS' : 'FAIL'}`)
  for (const [area, count] of Object.entries(report.analysis.primary_pool_by_area)) console.log(`${area}: primary pool ${count}`)
  if (process.argv.includes('--write-report')) {
    fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true })
    fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
    fs.writeFileSync(REPORT_MARKDOWN_PATH, renderMarkdown(report, 'Couple Phase 1B-2A Quality Checkpoint Report'))
    console.log(`WROTE ${path.relative(ROOT_DIR, REPORT_JSON_PATH)}`)
    console.log(`WROTE ${path.relative(ROOT_DIR, REPORT_MARKDOWN_PATH)}`)
  }
  if (!assertionsPassed) process.exitCode = 1
}

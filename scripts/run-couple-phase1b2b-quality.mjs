import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONSENSUS_ALGORITHM_VERSION } from '../supabase/functions/_shared/consensus.mjs'
import { evaluateRecommendationGates } from '../supabase/functions/_shared/recommendation-gates.mjs'
import {
  buildConsensusPlaces,
  buildCoverageReport,
  loadPhase1B2APlacePool,
  loadPhase1B2BPlacePool,
} from './import-couple-place-pool.mjs'
import { runPhase1B2AQualityHarness } from './run-couple-phase1b2a-quality.mjs'
import { loadScenarios, runQualityHarness } from './run-couple-production-pilot-quality.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE_SCENARIO_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b1', 'quality-scenarios.json')
const NEW_SCENARIO_PATH = path.join(ROOT_DIR, 'data', 'couple', 'phase1b2b', 'quality-scenarios.json')
const FINALIZER_PATH = path.join(ROOT_DIR, 'supabase', 'functions', 'finalize-decision-session', 'index.ts')
const CATALOG_SOURCE_PATH = path.join(ROOT_DIR, 'supabase', 'functions', '_shared', 'couple-catalog.mjs')
const REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2b-quality.json')
const REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2b-quality.md')
const AREAS = ['seongsu', 'hongdae', 'jongno_euljiro']
const BASE_SCENARIO_IDS = new Set(Array.from({ length: 15 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`))
const DOWNGRADED_ITEM_KEYS = new Set([
  'item-redbutton-seongsu',
  'item-about-the-chapter',
  'item-channel-1969',
  'item-liveclub-bbang',
  'item-book-gopsem',
  'item-1984-hongdae',
  'item-cafe-gongmyung-yeonnam',
  'event-kcdf-craft-design-competition-2026',
  'event-park-no-soo-mountain-objects-2026',
  'item-soha-saltpond-ikseon',
  'item-hyemindang',
  'item-teong',
])
const NEW_RESEARCH_HOLD_ITEM_KEYS = new Set([
  'item-yuyuhui-seongsu',
  'item-dynamic-maze-insadong',
])
const CHECKPOINT_CHANGED_ITEM_KEYS = new Set([...DOWNGRADED_ITEM_KEYS, ...NEW_RESEARCH_HOLD_ITEM_KEYS])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function countBy(values) {
  const counts = new Map()
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ko'))
}

function lowerSatisfaction(scenario) {
  return scenario.primary ? Math.min(scenario.primary.a_satisfaction, scenario.primary.b_satisfaction) : null
}

function summarize(scenarios) {
  const ready = scenarios.filter((scenario) => scenario.primary)
  const lower = ready.map(lowerSatisfaction)
  return {
    ready: ready.length,
    no_match: scenarios.filter((scenario) => scenario.status === 'no_match').map((scenario) => scenario.id),
    average_lower_satisfaction: lower.length
      ? Number((lower.reduce((sum, value) => sum + value, 0) / lower.length).toFixed(2))
      : null,
    primary_frequency: countBy(ready.map((scenario) => scenario.primary.name)),
    primary_category_frequency: countBy(ready.map((scenario) => scenario.primary.category)),
    primary_frequency_by_area: Object.fromEntries(AREAS.map((area) => {
      const areaReady = ready.filter((scenario) => scenario.meeting_area === area)
      return [area, countBy(areaReady.map((scenario) => scenario.primary.name))]
    })),
  }
}

function humanStatusCounts(items) {
  return Object.fromEntries(['keep_primary', 'alternative_only', 'research_hold'].map((status) => [
    status,
    items.filter((item) => item.human_curation_status === status).length,
  ]))
}

function areaConcentration(summary) {
  return Object.fromEntries(AREAS.map((area) => {
    const total = summary.primary_frequency_by_area[area].reduce((sum, entry) => sum + entry.count, 0)
    const top = summary.primary_frequency_by_area[area][0] || null
    return [area, {
      total,
      top_name: top?.name || null,
      top_count: top?.count || 0,
      top_share_percent: total && top ? Number((top.count / total * 100).toFixed(1)) : 0,
    }]
  }))
}

function combinedScenarios() {
  const base = loadScenarios(BASE_SCENARIO_PATH, 'couple-production-pilot-v1')
  const additional = JSON.parse(fs.readFileSync(NEW_SCENARIO_PATH, 'utf8'))
  assert(additional.dataset_version === 'couple-production-phase1b2b-v1', '1B-2B scenario dataset_version이 잘못됐습니다.')
  assert(Array.isArray(additional.scenarios) && additional.scenarios.length >= 10, '1B-2B 추가 시나리오가 부족합니다.')
  return {
    dataset_version: additional.dataset_version,
    as_of: additional.as_of,
    scenarios: [...base.scenarios, ...additional.scenarios].map((scenario) => ({
      ...scenario,
      human_review: undefined,
      root_cause: undefined,
    })),
  }
}

function categoryDistribution(pool, asOf) {
  const places = buildConsensusPlaces(pool)
  const eligible = places.filter((place) => evaluateRecommendationGates(place, asOf).alternativeEligible)
  const primary = places.filter((place) => evaluateRecommendationGates(place, asOf).primaryEligible)
  return Object.fromEntries(AREAS.map((area) => [area, {
    eligible: countBy(eligible.filter((place) => place.meetingArea === area).map((place) => place.category)),
    primary: countBy(primary.filter((place) => place.meetingArea === area).map((place) => place.category)),
  }]))
}

function formatAlternatives(items) {
  return items.length ? items.map((item) => `${item.name} [${item.human_curation_status}]`).join('<br>') : '-'
}

function formatDistribution(values) {
  return values.map((entry) => `${entry.name} ${entry.count}`).join(', ') || '-'
}

function renderMarkdown(report) {
  const lines = [
    '# Couple Phase 1B-2B Local Quality Report',
    '',
    `- Dataset: \`${report.dataset_version}\``,
    `- 기준 시각: ${report.as_of}`,
    `- Venue: ${report.totals.venues} (신규 ${report.totals.new_venues})`,
    `- Recommendation Item: ${report.totals.items} (신규 ${report.totals.new_items})`,
    `- 현재 추천 가능: ${report.totals.eligible_items}, 강력추천 가능: ${report.totals.primary_items}`,
    `- 전체 Human 상태: keep_primary ${report.human_status_totals.keep_primary}, alternative_only ${report.human_status_totals.alternative_only}, research_hold ${report.human_status_totals.research_hold}`,
    `- 신규 Human 상태: keep_primary ${report.new_human_status_totals.keep_primary}, alternative_only ${report.new_human_status_totals.alternative_only}, research_hold ${report.new_human_status_totals.research_hold}`,
    '- Remote DB 반영: 안 함',
    '- 공개 `/couple`: fixture 유지',
    '',
    '## Coverage before / after',
    '',
    '| 권역 | 추천 가능 | keep_primary | cafe | low / medium / high | new | ≤2만원 | ≤120분 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ]
  for (const area of AREAS) {
    const before = report.coverage.before[area]
    const after = report.coverage.after[area]
    lines.push(`| ${area} | ${before.eligible_item_count}→${after.eligible_item_count} | ${before.primary_item_count}→${after.primary_item_count} | ${before.activity.cafe}→${after.activity.cafe} | ${before.energy.low}/${before.energy.medium}/${before.energy.high}→${after.energy.low}/${after.energy.medium}/${after.energy.high} | ${before.novelty.new}→${after.novelty.new} | ${before.budget_preference.under_20000}→${after.budget_preference.under_20000} | ${before.duration.under_120_minutes}→${after.duration.under_120_minutes} |`)
  }
  lines.push(
    '',
    '## S01~S15 checkpoint before / approved after',
    '',
    '| ID | 권역 | Before 강력추천 | After 강력추천 | 낮은 쪽 만족도 | After 대안 |',
    '|---|---|---|---|---:|---|',
  )
  for (const scenario of report.base_scenarios) {
    lines.push(`| ${scenario.id} | ${scenario.meeting_area} | ${scenario.before.primary?.name || 'no_match'} | ${scenario.after.primary?.name || 'no_match'} | ${scenario.before.lower_satisfaction ?? '-'}→${scenario.after.lower_satisfaction ?? '-'} | ${formatAlternatives(scenario.after.alternatives)} |`)
  }
  lines.push(
    '',
    '## 추가 시나리오',
    '',
    '| ID | 시나리오 | 강력추천 | A/B/Consensus | 대안 |',
    '|---|---|---|---:|---|',
  )
  for (const scenario of report.additional_scenarios) {
    const score = scenario.primary
      ? `${scenario.primary.a_satisfaction}/${scenario.primary.b_satisfaction}/${scenario.primary.consensus_score}`
      : '-'
    lines.push(`| ${scenario.id} | ${scenario.title} | ${scenario.primary?.name || 'no_match'} | ${score} | ${formatAlternatives(scenario.alternatives)} |`)
  }
  lines.push(
    '',
    '## 결과 지표',
    '',
    `- S01~S15 no_match: ${report.quality.checkpoint_before.no_match.length}→${report.quality.after.no_match.length} (${report.quality.after.no_match.join(', ') || '없음'})`,
    `- S01~S15 낮은 쪽 평균 만족도: ${report.quality.checkpoint_before.average_lower_satisfaction}→${report.quality.after.average_lower_satisfaction}`,
    `- 참고 1B-2A baseline 낮은 쪽 평균 만족도: ${report.quality.phase1b2a_baseline.average_lower_satisfaction}`,
    `- 전체 ${report.totals.scenarios}개 시나리오 1위 최다: ${report.quality.all.primary_frequency[0]?.name || '-'} ${report.quality.all.primary_frequency[0]?.count || 0}회`,
    '',
    '### 권역별 1위 분산',
    '',
    ...Object.entries(report.quality.all.primary_frequency_by_area).map(([area, entries]) => `- ${area}: ${formatDistribution(entries)}`),
    '',
    '### 권역별 최고 집중도',
    '',
    ...Object.entries(report.quality.area_concentration).map(([area, value]) => `- ${area}: ${value.top_name || '-'} ${value.top_count}/${value.total} (${value.top_share_percent}%)`),
    '',
    `### Category별 1위 분포: ${formatDistribution(report.quality.all.primary_category_frequency)}`,
    '',
    '### 후보 pool Category 분포',
    '',
    ...Object.entries(report.category_distribution).flatMap(([area, value]) => [
      `- ${area} 추천 가능: ${formatDistribution(value.eligible)}`,
      `- ${area} 강력추천 가능: ${formatDistribution(value.primary)}`,
    ]),
    '',
    '## 신규 Item 전체 목록',
    '',
    '| 권역 | Item | Venue | 종류 | primary | category | Human | availability | 근거 |',
    '|---|---|---|---|---|---|---|---|---|',
  )
  for (const item of report.new_items) {
    lines.push(`| ${item.meeting_area} | ${item.name} | ${item.venue} | ${item.kind} | ${item.primary_activity} | ${item.category} | ${item.human_status} | ${item.availability} | ${item.evidence} |`)
  }
  lines.push(
    '',
    '## Assertions',
    '',
    ...Object.entries(report.assertions).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'} — ${name}`),
    '',
    '## 해석',
    '',
    ...report.notes.map((note) => `- ${note}`),
    '',
  )
  return `${lines.join('\n')}\n`
}

export function runPhase1B2BQualityHarness() {
  const beforePool = loadPhase1B2APlacePool()
  const afterPool = loadPhase1B2BPlacePool()
  const scenarioFile = combinedScenarios()
  const preCheckpointPool = {
    ...afterPool,
    items: afterPool.items.map((item) => CHECKPOINT_CHANGED_ITEM_KEYS.has(item.source_key)
      ? { ...item, human_curation_status: 'keep_primary' }
      : item),
  }
  const beforeRaw = runPhase1B2AQualityHarness()
  const beforeScenarios = beforeRaw.scenarios.filter((scenario) => BASE_SCENARIO_IDS.has(scenario.id))
  const preCheckpointRaw = runQualityHarness({
    pool: preCheckpointPool,
    scenarioFile,
    assertionBuilder: () => ({ checkpoint_baseline_captured: true }),
  })
  const preCheckpointBaseScenarios = preCheckpointRaw.scenarios.filter((scenario) => BASE_SCENARIO_IDS.has(scenario.id))
  const preCheckpointById = new Map(preCheckpointBaseScenarios.map((scenario) => [scenario.id, scenario]))
  const afterRaw = runQualityHarness({
    pool: afterPool,
    scenarioFile,
    assertionBuilder: () => ({ harness_completed: true }),
  })
  const afterBaseScenarios = afterRaw.scenarios.filter((scenario) => BASE_SCENARIO_IDS.has(scenario.id))
  const additionalScenarios = afterRaw.scenarios.filter((scenario) => !BASE_SCENARIO_IDS.has(scenario.id))
  const afterById = new Map(afterBaseScenarios.map((scenario) => [scenario.id, scenario]))
  const asOf = new Date(afterRaw.as_of)
  const beforeCoverage = buildCoverageReport(beforePool, asOf)
  const afterCoverage = buildCoverageReport(afterPool, asOf)
  const venuesByKey = new Map(afterPool.venues.map((venue) => [venue.source_key, venue]))
  const newItems = afterPool.items
    .filter((item) => afterPool.phase1b2b_item_keys.includes(item.source_key))
    .map((item) => ({
      source_key: item.source_key,
      meeting_area: venuesByKey.get(item.venue_source_key).meeting_area,
      name: item.canonical_name,
      venue: venuesByKey.get(item.venue_source_key).canonical_name,
      kind: item.item_kind,
      primary_activity: item.primary_activity_type,
      category: item.category,
      human_status: item.human_curation_status,
      availability: item.availability_status,
      evidence: item.editorial_evidence_refs[0]?.url || '-',
    }))
  const phase1B2ABaselineSummary = summarize(beforeScenarios)
  const preCheckpointSummary = summarize(preCheckpointBaseScenarios)
  const afterSummary = summarize(afterBaseScenarios)
  const allSummary = summarize(afterRaw.scenarios)
  const humanStatusTotals = humanStatusCounts(afterPool.items)
  const newHumanStatusTotals = humanStatusCounts(afterPool.items.filter((item) => afterPool.phase1b2b_item_keys.includes(item.source_key)))
  const selected = afterRaw.scenarios.flatMap((scenario) => [scenario.primary, ...scenario.alternatives]).filter(Boolean)
  const selectedPrimaries = afterRaw.scenarios.map((scenario) => scenario.primary).filter(Boolean)
  const concentration = areaConcentration(allSummary)
  const consensusPlaces = buildConsensusPlaces(afterPool)
  const primaryPlaces = consensusPlaces.filter((place) => evaluateRecommendationGates(place, asOf).primaryEligible)
  const cafePrimaryByArea = Object.fromEntries(AREAS.map((area) => [area, primaryPlaces
    .filter((place) => place.meetingArea === area && place.primaryActivityType === 'cafe')
    .map((place) => place.name)]))
  const publicFinalizer = fs.readFileSync(FINALIZER_PATH, 'utf8')
  const catalogSource = fs.readFileSync(CATALOG_SOURCE_PATH, 'utf8')
  const s04 = afterById.get('S04')
  const s14 = afterById.get('S14')
  const s15 = afterById.get('S15')
  const assertions = {
    local_pool_counts_are_132_venues_143_items: afterPool.venues.length === 132 && afterPool.items.length === 143,
    human_status_totals_are_42_90_11: humanStatusTotals.keep_primary === 42
      && humanStatusTotals.alternative_only === 90
      && humanStatusTotals.research_hold === 11,
    new_human_status_totals_are_22_42_8: newHumanStatusTotals.keep_primary === 22
      && newHumanStatusTotals.alternative_only === 42
      && newHumanStatusTotals.research_hold === 8,
    eligible_area_counts_are_40_41_39: afterCoverage.areas.seongsu.eligible_item_count === 40
      && afterCoverage.areas.hongdae.eligible_item_count === 41
      && afterCoverage.areas.jongno_euljiro.eligible_item_count === 39,
    operational_primary_area_counts_are_12_15_13: afterCoverage.areas.seongsu.primary_item_count === 12
      && afterCoverage.areas.hongdae.primary_item_count === 15
      && afterCoverage.areas.jongno_euljiro.primary_item_count === 13,
    only_keep_primary_selected_first: afterRaw.scenarios.every((scenario) => !scenario.primary
      || scenario.primary.human_curation_status === 'keep_primary'),
    alternative_only_never_selected_first: afterRaw.scenarios.every((scenario) => scenario.primary?.human_curation_status !== 'alternative_only'),
    alternative_only_used_as_alternative: selected.some((item) => item.human_curation_status === 'alternative_only'),
    item_1984_primary_zero: !selectedPrimaries.some((item) => item.source_key === 'item-1984-hongdae'),
    downgraded_12_primary_zero: !selectedPrimaries.some((item) => DOWNGRADED_ITEM_KEYS.has(item.source_key)),
    research_hold_never_selected: !selected.some((item) => item.human_curation_status === 'research_hold'),
    s04_now_has_cafe_primary: s04?.primary?.activity_type === 'cafe',
    s14_now_has_cafe_primary: s14?.primary?.activity_type === 'cafe',
    s15_no_match_resolved: s15?.status === 'ready',
    no_match_not_increased: afterSummary.no_match.length <= preCheckpointSummary.no_match.length,
    no_area_primary_concentration_at_or_above_40_percent: Object.values(concentration).every((value) => value.top_share_percent < 40),
    consensus_algorithm_version_unchanged: CONSENSUS_ALGORITHM_VERSION === 'consensus-v1.1',
    public_couple_still_uses_fixture: publicFinalizer.includes("Deno.env.get('COUPLE_PLACE_SOURCE')")
      && catalogSource.includes('return COUPLE_PLACE_SOURCES.fixture')
      && catalogSource.includes('getFixturePlaces(meetingArea)')
      && !publicFinalizer.includes('loadPhase1B2BPlacePool'),
    family_derivation_absent: afterPool.items.every((item) => !('family_place_id' in item) && !('derived_from_family_id' in item)),
    scheduled_items_excluded_until_valid_from: afterCoverage.totals.scheduled_items === 3,
  }
  return {
    dataset_version: afterPool.dataset_version,
    as_of: afterRaw.as_of,
    consensus_algorithm_version: CONSENSUS_ALGORITHM_VERSION,
    totals: {
      venues: afterPool.venues.length,
      items: afterPool.items.length,
      new_venues: afterPool.venues.length - beforePool.venues.length,
      new_items: newItems.length,
      eligible_items: afterCoverage.totals.eligible_items,
      primary_items: afterCoverage.totals.primary_eligible_items,
      scenarios: afterRaw.scenarios.length,
    },
    coverage: {
      before: beforeCoverage.areas,
      after: afterCoverage.areas,
    },
    category_distribution: categoryDistribution(afterPool, asOf),
    human_status_totals: humanStatusTotals,
    new_human_status_totals: newHumanStatusTotals,
    cafe_primary_by_area: cafePrimaryByArea,
    base_scenarios: preCheckpointBaseScenarios.map((before) => {
      const after = afterById.get(before.id)
      return {
        id: before.id,
        meeting_area: before.meeting_area,
        before: { status: before.status, primary: before.primary, alternatives: before.alternatives, lower_satisfaction: lowerSatisfaction(before) },
        after: { status: after.status, primary: after.primary, alternatives: after.alternatives, lower_satisfaction: lowerSatisfaction(after) },
      }
    }),
    additional_scenarios: additionalScenarios,
    quality: {
      phase1b2a_baseline: phase1B2ABaselineSummary,
      checkpoint_before: preCheckpointSummary,
      after: afterSummary,
      all: allSummary,
      area_concentration: concentration,
    },
    new_items: newItems,
    assertions,
    notes: [
      '1984와 승인된 downgrade 12개는 1위 0회이며, research_hold 11개는 primary·alternative 모두 0회입니다.',
      '홍대 broad-trait 집중은 1984 4/9에서 제비다방 3/9로 이동했지만 40% 기준 아래이며 씨네마포도 2/9로 분산됐습니다.',
      '27개 1위 중 cafe가 11개로 가장 많습니다. 입력 시나리오에 cafe·저에너지·실내 요청이 반복된 영향이 있으나 Human 축소 후 카페 쏠림은 계속 관찰 대상입니다.',
      `카페형 primary는 성수 ${cafePrimaryByArea.seongsu.length}개, 홍대 ${cafePrimaryByArea.hongdae.length}개, 종로 ${cafePrimaryByArea.jongno_euljiro.length}개입니다. 성수·종로는 각각 한 곳뿐이라 결과는 정상이어도 후보 이중화는 부족합니다.`,
      'S01~S15 낮은 쪽 평균 만족도는 checkpoint 90.00에서 88.15로 1.85점 하락했지만 1B-2A baseline 82.49보다 높고 no_match는 0건을 유지했습니다.',
      '예정 Event와 research_hold는 fail-closed이며 현재 추천 결과에 포함되지 않습니다.',
      'Consensus 가중치·fairness·Editorial Score·Human Gate 규칙은 변경하지 않았습니다.',
    ],
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const report = runPhase1B2BQualityHarness()
  const passed = Object.values(report.assertions).every(Boolean)
  console.log(`Phase 1B-2B quality — Venue ${report.totals.venues}, Item ${report.totals.items}, eligible ${report.totals.eligible_items}, primary ${report.totals.primary_items}`)
  console.log(`S01~S15 no_match ${report.quality.checkpoint_before.no_match.length}→${report.quality.after.no_match.length}; lower satisfaction ${report.quality.checkpoint_before.average_lower_satisfaction}→${report.quality.after.average_lower_satisfaction}`)
  console.log(`Assertions — ${passed ? 'PASS' : 'FAIL'}`)
  if (process.argv.includes('--write-report')) {
    fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true })
    fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
    fs.writeFileSync(REPORT_MARKDOWN_PATH, renderMarkdown(report))
    console.log(`WROTE ${path.relative(ROOT_DIR, REPORT_JSON_PATH)}`)
    console.log(`WROTE ${path.relative(ROOT_DIR, REPORT_MARKDOWN_PATH)}`)
  }
  if (!passed) process.exitCode = 1
}

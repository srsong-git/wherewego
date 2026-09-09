import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONSENSUS_ALGORITHM_VERSION } from '../supabase/functions/_shared/consensus.mjs'
import { runPhase1B2AQualityHarness } from './run-couple-phase1b2a-quality.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_JSON_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-human-curation-gate-quality.json')
const REPORT_MARKDOWN_PATH = path.join(ROOT_DIR, 'reports', 'couple', 'phase1b2a-human-curation-gate-quality.md')
const BASE_SCENARIO_IDS = new Set(Array.from({ length: 15 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`))
const RETAIL_ITEM_KEYS = new Set([
  'item-oliveyoung-n-seongsu',
  'item-tamburins-seongsu',
  'item-amore-seongsu-visit',
  'item-adererror-seongsu',
  'item-oh-lolly-day-seongsu',
  'item-kith-seoul',
  'item-whipped-house',
  'item-point-of-view-seoul',
  'item-object-seogyo',
  'item-nonfiction-samcheong',
  'item-sulwhasoo-bukchon',
  'item-musinsa-megastore-seongsu',
  'item-haus-nowhere-seoul',
  'item-lcdc-seoul',
])
const HONGDAE_GAME_ITEM_KEYS = new Set([
  'item-beat-phobia-hongdae-dungeon3',
  'item-code-k-hongdae',
  'item-zero-world-hongdae',
  'item-redbutton-layered-hongdae',
  'item-w-rock-bowling-hongdae',
])
const RESEARCH_HOLD_ITEM_KEYS = new Set([
  'event-amore-story-a-beauty-murder',
  'item-w-rock-bowling-hongdae',
  'item-seoul-record',
])

function baseScenarios(report) {
  return report.scenarios.filter((scenario) => BASE_SCENARIO_IDS.has(scenario.id))
}

function countBy(values) {
  const counts = new Map()
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ko'))
}

function summarize(scenarios) {
  const ready = scenarios.filter((scenario) => scenario.primary)
  const selected = scenarios.flatMap((scenario) => [scenario.primary, ...scenario.alternatives]).filter(Boolean)
  const minimumSatisfaction = ready.map((scenario) => Math.min(
    scenario.primary.a_satisfaction,
    scenario.primary.b_satisfaction,
  ))
  const byArea = Object.fromEntries(['seongsu', 'hongdae', 'jongno_euljiro'].map((area) => {
    const areaReady = ready.filter((scenario) => scenario.meeting_area === area)
    return [area, {
      ready: areaReady.length,
      frequencies: countBy(areaReady.map((scenario) => scenario.primary.name)),
    }]
  }))
  const retailPrimaries = ready.filter((scenario) => RETAIL_ITEM_KEYS.has(scenario.primary.source_key))
  const hongdaeReady = ready.filter((scenario) => scenario.meeting_area === 'hongdae')
  const hongdaeGamePrimaries = hongdaeReady.filter((scenario) => HONGDAE_GAME_ITEM_KEYS.has(scenario.primary.source_key))
  return {
    ready: ready.length,
    no_match: scenarios.filter((scenario) => scenario.status === 'no_match').map((scenario) => scenario.id),
    average_lower_satisfaction: minimumSatisfaction.length
      ? Number((minimumSatisfaction.reduce((sum, value) => sum + value, 0) / minimumSatisfaction.length).toFixed(2))
      : null,
    primary_frequency: countBy(ready.map((scenario) => scenario.primary.name)),
    primary_frequency_by_area: byArea,
    retail_primary_count: retailPrimaries.length,
    retail_primary_items: countBy(retailPrimaries.map((scenario) => scenario.primary.name)),
    hongdae_game_primary_count: hongdaeGamePrimaries.length,
    hongdae_game_primary_share_percent: hongdaeReady.length
      ? Number((hongdaeGamePrimaries.length / hongdaeReady.length * 100).toFixed(1))
      : 0,
    hongdae_game_primary_items: countBy(hongdaeGamePrimaries.map((scenario) => scenario.primary.name)),
    alternative_only_appearances: selected.filter((item) => item.human_curation_status === 'alternative_only').length,
    alternative_only_items: countBy(selected
      .filter((item) => item.human_curation_status === 'alternative_only')
      .map((item) => item.name)),
    research_hold_appearances: selected.filter((item) => RESEARCH_HOLD_ITEM_KEYS.has(item.source_key)).length,
  }
}

function compactAlternative(items) {
  return items.map((item) => `${item.name}${item.human_curation_status ? ` [${item.human_curation_status}]` : ''}`).join(', ') || '-'
}

function renderMarkdown(report) {
  const lines = [
    '# Couple Phase 1B-2A Human Curation Gate Quality Report',
    '',
    `- Dataset: \`${report.dataset_version}\``,
    `- Consensus algorithm: \`${report.consensus_algorithm_version}\` (변경 없음)`,
    `- 기준 시각: ${report.as_of}`,
    '- 범위: 기존 production quality S01~S15',
    '- 공개 `/couple` dataset 변경: 없음',
    '',
    '## Before / After',
    '',
    '| ID | 권역 | Before 강력추천 | After 강력추천 | 낮은 쪽 만족도 Before→After | After 대안 |',
    '|---|---|---|---|---:|---|',
  ]
  for (const scenario of report.scenarios) {
    lines.push(`| ${scenario.id} | ${scenario.meeting_area} | ${scenario.before.primary?.name || 'no_match'} | ${scenario.after.primary?.name || 'no_match'} | ${scenario.before.lower_satisfaction ?? '-'} → ${scenario.after.lower_satisfaction ?? '-'} | ${compactAlternative(scenario.after.alternatives)} |`)
  }
  lines.push(
    '',
    '## 핵심 지표',
    '',
    `- no_match: ${report.before.no_match.length} → ${report.after.no_match.length} (${report.after.no_match.join(', ') || '없음'})`,
    `- 낮은 쪽 평균 만족도: ${report.before.average_lower_satisfaction} → ${report.after.average_lower_satisfaction}`,
    `- Retail 1위: ${report.before.retail_primary_count} → ${report.after.retail_primary_count}`,
    `- 홍대 방탈출·게임 1위: ${report.before.hongdae_game_primary_count} → ${report.after.hongdae_game_primary_count} (${report.after.hongdae_game_primary_share_percent}%)`,
    `- alternative_only 대안 활용: ${report.after.alternative_only_appearances}회`,
    `- research_hold 결과 등장: ${report.after.research_hold_appearances}회`,
    '',
    '## 권역별 After 1위 분산',
    '',
    ...Object.entries(report.after.primary_frequency_by_area).map(([area, value]) => `- ${area}: ${value.frequencies.map((entry) => `${entry.name} ${entry.count}회`).join(', ') || 'no_match만 발생'}`),
    '',
    '## 판정',
    '',
    ...Object.entries(report.assertions).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'} — ${name}`),
    '',
    '## 원인 분류',
    '',
    ...report.root_cause_notes.map((note) => `- ${note}`),
    '',
  )
  return `${lines.join('\n')}\n`
}

export function runHumanCurationQualityHarness() {
  const beforeReport = runPhase1B2AQualityHarness({ humanGateMode: 'before' })
  const afterReport = runPhase1B2AQualityHarness()
  const beforeScenarios = baseScenarios(beforeReport)
  const afterScenarios = baseScenarios(afterReport)
  const afterById = new Map(afterScenarios.map((scenario) => [scenario.id, scenario]))
  const before = summarize(beforeScenarios)
  const after = summarize(afterScenarios)
  const scenarios = beforeScenarios.map((beforeScenario) => {
    const afterScenario = afterById.get(beforeScenario.id)
    return {
      id: beforeScenario.id,
      meeting_area: beforeScenario.meeting_area,
      before: {
        status: beforeScenario.status,
        primary: beforeScenario.primary,
        lower_satisfaction: beforeScenario.primary
          ? Math.min(beforeScenario.primary.a_satisfaction, beforeScenario.primary.b_satisfaction)
          : null,
        alternatives: beforeScenario.alternatives,
      },
      after: {
        status: afterScenario.status,
        primary: afterScenario.primary,
        lower_satisfaction: afterScenario.primary
          ? Math.min(afterScenario.primary.a_satisfaction, afterScenario.primary.b_satisfaction)
          : null,
        alternatives: afterScenario.alternatives,
      },
    }
  })
  const selectedAfter = scenarios.flatMap((scenario) => [scenario.after.primary, ...scenario.after.alternatives]).filter(Boolean)
  const primaryAfter = scenarios.map((scenario) => scenario.after.primary).filter(Boolean)
  const namedPrimaryCount = (name) => primaryAfter.filter((item) => item.name === name).length
  const assertions = {
    oliveyoung_primary_zero: namedPrimaryCount('올리브영 N성수') === 0,
    object_seogyo_primary_zero: namedPrimaryCount('오브젝트 서교점') === 0,
    amore_seongsu_primary_zero: namedPrimaryCount('아모레 성수') === 0,
    only_keep_primary_selected_first: primaryAfter.every((item) => item.human_curation_status === 'keep_primary'),
    alternative_only_used_as_alternative: selectedAfter.some((item) => item.human_curation_status === 'alternative_only'),
    research_hold_never_selected: after.research_hold_appearances === 0,
    retail_primary_reduced: after.retail_primary_count < before.retail_primary_count,
    no_match_not_excessive: after.no_match.length <= before.no_match.length + 2,
    weighted_consensus_version_unchanged: CONSENSUS_ALGORITHM_VERSION === 'consensus-v1.1',
  }
  return {
    dataset_version: afterReport.dataset_version,
    as_of: afterReport.as_of,
    consensus_algorithm_version: CONSENSUS_ALGORITHM_VERSION,
    scenarios,
    before,
    after,
    assertions,
    root_cause_notes: [
      'keep_primary 후보 부족: 성수 S15는 엄격한 예산·시간·veto 뒤 primary가 남지 않아 no_match가 됐고, S04는 쉬기·카페형 keep_primary 부족으로 낮은 만족도의 체험이 1위가 됐습니다.',
      'Preference Coverage 부족: 종로 S14는 cafe keep_primary가 없어 전시형 아라리오뮤지엄이 61.7점으로 선택됐고, 홍대 S05·S13은 cafe/walk 성격의 primary 공백이 남았습니다.',
      'category 편중: 홍대 방탈출·게임 1위는 1/5로 증가하지 않았지만 강재구 개인전이 3/5를 차지해 전시 Event 쏠림을 후속 소싱에서 관찰해야 합니다.',
      '태깅 문제: S01~S15에서 새 hard-filter 위반은 확인되지 않았습니다. 낮은 결과는 현재 태그 오류보다 Human primary 자격과 coverage 축소로 설명됩니다.',
      '알고리즘 문제: weighted Consensus·fairness·Editorial Score는 변경하지 않았으며 이번 결과만으로 점수식 수정 근거는 확인하지 않았습니다.',
      '의도된 동작: alternative_only는 23회 대안으로 활용됐고 research_hold는 primary·alternative 모두 0회였습니다.',
    ],
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const report = runHumanCurationQualityHarness()
  const passed = Object.values(report.assertions).every(Boolean)
  console.log(`Human Curation quality — S01~S15, no_match ${report.before.no_match.length}→${report.after.no_match.length}, retail primary ${report.before.retail_primary_count}→${report.after.retail_primary_count}`)
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

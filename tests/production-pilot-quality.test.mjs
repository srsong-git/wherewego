import assert from 'node:assert/strict'
import test from 'node:test'
import { runQualityHarness } from '../scripts/run-couple-production-pilot-quality.mjs'

test('production pilot 품질 하네스는 공개 dataset을 바꾸지 않고 15개 시나리오를 실행한다', () => {
  const report = runQualityHarness()
  assert.equal(report.public_dataset_changed, false)
  assert.equal(report.dataset_version, 'couple-production-pilot-v1')
  assert.equal(report.totals.eligible_items, 17)
  assert.equal(report.scenarios.length, 15)
  assert.deepEqual(new Set(report.scenarios.map((scenario) => scenario.meeting_area)), new Set([
    'seongsu',
    'hongdae',
    'jongno_euljiro',
  ]))
})

test('Editorial/Availability 품질 assertion이 production pilot 시나리오에서 모두 통과한다', () => {
  const report = runQualityHarness()
  assert.ok(Object.values(report.assertions).every(Boolean), JSON.stringify(report.assertions))
  assert.deepEqual(report.analysis.no_match_scenarios, ['S13'])
  assert.equal(report.scenarios.find((scenario) => scenario.id === 'S13').counts.hardFilterPassed, 1)
  assert.equal(report.scenarios.find((scenario) => scenario.id === 'S13').counts.primaryEligibleAfterHardFilter, 0)
})

test('반복 추천 분석은 권역별 primary 후보 부족을 드러낸다', () => {
  const report = runQualityHarness()
  assert.deepEqual(report.analysis.primary_pool_by_area, {
    seongsu: 3,
    hongdae: 2,
    jongno_euljiro: 5,
  })
  assert.equal(report.analysis.primary_frequency_by_area.seongsu.frequencies[0].name, '아모레 성수')
  assert.equal(report.analysis.primary_frequency_by_area.seongsu.frequencies[0].share_percent, 100)
  assert.equal(report.analysis.primary_frequency_by_area.hongdae.frequencies[0].share_percent, 75)
})

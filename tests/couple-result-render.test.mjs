import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const places = [
  { id: 'primary', name: '[Fixture] 새활용 문화 체험', description: '개발용 체험 fixture예요', category: 'cafe', energy: 'low', novelty: 'balanced', budgetPerPerson: 15000, durationMinutes: 120 },
  { id: 'active', name: '플로디스튜디오', category: 'experience', energy: 'high', novelty: 'balanced', budgetPerPerson: 20000, durationMinutes: 120 },
  { id: 'special', name: '성수 새 전시', category: 'exhibition', energy: 'medium', novelty: 'new', waitRisk: 'low', budgetPerPerson: 10000, durationMinutes: 90 },
]

test('40% 결과는 자연어 메시지를 먼저 보여주고 추천 위계를 한국어로 표현한다', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    const { default: CoupleResult, CouplePlaceModal } = await vite.ssrLoadModule('/src/couple/CoupleResult.jsx')
    const { toDisplayPlace } = await vite.ssrLoadModule('/src/couple/placePresentation.js')
    const roomState = {
      result: {
        datasetVersion: 'couple-fixture-v1',
        agreementScore: 40,
        sharedPoints: ['둘 다 1인 2만원 이하를 생각했어요', '둘 다 적당히 움직이기를 원했어요'],
        differencePoints: ['한 분은 쉬고 싶음, 다른 한 분은 활동적으로 보내기를 원했어요'],
        compromiseText: '기존 알고리즘 보고서 문구',
        items: places.map((place, index) => ({
          rank: index + 1,
          placeId: place.id,
          reason: index === 0 ? '오늘의 예전 강추천 문구' : '같은 대안 문구',
          place,
        })),
      },
    }

    const html = renderToStaticMarkup(React.createElement(CoupleResult, { roomState }))

    assert.match(html, /오늘은 취향이 조금 갈렸어요/)
    assert.match(html, /오늘의 취향 겹침 <strong>40%<\/strong>/)
    assert.match(html, /연애 궁합이 아니라/)
    assert.match(html, /둘 다 원하는 건/)
    assert.match(html, /오늘 조금 달랐던 건/)
    assert.match(html, /그래서 이렇게 골랐어요/)
    assert.match(html, /오늘의 강력추천/)
    assert.match(html, /조금 더 활동적으로 보내고 싶다면/)
    assert.match(html, /조금 더 특별한 분위기를 원한다면/)
    assert.doesNotMatch(html, /CONSENSUS PICK|오늘의 예전 강추천 문구|같은 대안 문구/)
    assert.match(html, /class="safe-share-button"[^>]*>결과 공유하기/)
    assert.doesNotMatch(html, /안전하게 결과 공유하기/)
    assert.doesNotMatch(html, /Fixture|Phase 1A|개발용 데이터/)
    assert.match(html, /새활용 문화 체험/)
    assert.match(html, /플로디스튜디오/)
    assert.equal(roomState.result.items[0].place.name, '[Fixture] 새활용 문화 체험')
    assert.match(html, /방문 전 장소 운영 여부와 예약·가격의 최신 정보를 확인해 주세요/)
    assert.ok(html.indexOf('오늘은 취향이 조금 갈렸어요') < html.indexOf('오늘의 취향 겹침'))

    const modalHtml = renderToStaticMarkup(React.createElement(CouplePlaceModal, {
      place: toDisplayPlace({
        ...places[0],
        area: '서울 성동',
        address: '서울 성동구 테스트로 1',
        walkingLevel: 'low',
        waitRisk: 'low',
      }, { datasetVersion: roomState.result.datasetVersion }),
      onClose: () => {},
    }))
    assert.doesNotMatch(modalHtml, /개발용 체험 fixture예요|couple-place-description/)
  } finally {
    await vite.close()
  }
})

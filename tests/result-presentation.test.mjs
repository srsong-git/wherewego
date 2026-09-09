import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAgreementMessage,
  getAlternativeLead,
  getCompromiseCopy,
  getDifferencePointCopy,
  getSharedPointCopy,
} from '../src/couple/resultPresentation.js'

test('취향 겹침 점수 구간마다 지정된 자연어 메시지를 사용한다', () => {
  assert.equal(getAgreementMessage(100), '오늘은 거의 같은 생각이에요 💕')
  assert.equal(getAgreementMessage(80), '오늘은 거의 같은 생각이에요 💕')
  assert.equal(getAgreementMessage(79), '오늘은 꽤 잘 맞아요 😊')
  assert.equal(getAgreementMessage(60), '오늘은 꽤 잘 맞아요 😊')
  assert.equal(getAgreementMessage(59), '오늘은 취향이 조금 갈렸어요 😄')
  assert.equal(getAgreementMessage(40), '오늘은 취향이 조금 갈렸어요 😄')
  assert.equal(getAgreementMessage(39), '오늘은 취향이 꽤 갈렸어요 👀')
  assert.equal(getAgreementMessage(0), '오늘은 취향이 꽤 갈렸어요 👀')
})

test('공통점은 보고서 문장 대신 짧고 자연스러운 표현으로 바꾼다', () => {
  assert.equal(getSharedPointCopy('둘 다 1인 2만원 이하를 생각했어요'), '너무 비싸지 않은 곳')
  assert.equal(getSharedPointCopy('둘 다 적당히 움직이기를 원했어요'), '부담 없이 즐길 수 있는 곳')
  assert.equal(getSharedPointCopy('둘 다 긴 웨이팅 피하기를 원했어요'), '오래 기다리지 않는 곳')
})

test('차이점은 참여자를 특정하지 않고 사람 말처럼 설명한다', () => {
  const energyCopy = getDifferencePointCopy('한 분은 쉬고 싶음, 다른 한 분은 활동적으로 보내기를 원했어요')
  const budgetCopy = getDifferencePointCopy('예산은 1인 2만원 이하와 1인 4만원 이하로 달랐어요')

  assert.equal(energyCopy, '한 사람은 활동적으로 시간을 보내는 쪽이고, 다른 사람은 편하게 쉬는 쪽이에요.')
  assert.equal(budgetCopy, '두 사람이 생각한 예산대가 조금 달라요. 더 부담 없는 쪽을 기준으로 봤어요.')
  assert.doesNotMatch(`${energyCopy} ${budgetCopy}`, /A님|B님|UUID|한 분/)
})

test('절충 문구와 대안 선택 이유는 템플릿 기반이며 서로 다른 맥락을 준다', () => {
  const compromise = getCompromiseCopy({ items: [{ place: { energy: 'medium', novelty: 'new' } }] })
  const relaxed = getAlternativeLead({ energy: 'low', category: 'cafe' }, 0)
  const special = getAlternativeLead({ novelty: 'new', category: 'experience' }, 1)

  assert.equal(compromise, '가볍게 즐길 수 있으면서도 평소와는 조금 다른 곳을 골랐어요.')
  assert.equal(relaxed, '조금 더 편하게 보내고 싶다면')
  assert.equal(special, '조금 더 특별한 분위기를 원한다면')
  assert.notEqual(relaxed, special)
})

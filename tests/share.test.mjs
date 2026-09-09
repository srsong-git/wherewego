import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInviteUrl,
  buildSafeResultShare,
  copyText,
  SAFE_COUPLE_URL,
  shouldOfferMobileShare,
} from '../src/couple/share.js'

test('Web Share는 모바일이면서 API를 지원할 때만 초대 화면에 제공한다', () => {
  assert.equal(shouldOfferMobileShare({ hasShare: true, isMobile: true }), true)
  assert.equal(shouldOfferMobileShare({ hasShare: true, isMobile: false }), false)
  assert.equal(shouldOfferMobileShare({ hasShare: false, isMobile: true }), false)
})

test('초대 URL은 방 경로와 secret fragment를 정확히 포함한다', () => {
  const url = buildInviteUrl('http://127.0.0.1:5173/', '507e4e3ca40a5500', 'secret-value')
  assert.equal(url, 'http://127.0.0.1:5173/couple/r/507e4e3ca40a5500#invite=secret-value')
})

test('초대 링크 복사는 URL만 Clipboard API에 전달한다', async () => {
  let copied = ''
  const clipboard = { writeText: async (text) => { copied = text } }
  const url = 'https://oneulwhere.kr/couple/r/507e4e3ca40a5500#invite=secret-value'

  const result = await copyText(url, clipboard)

  assert.equal(copied, url)
  assert.deepEqual(result, { mode: 'clipboard', status: 'copied' })
})

test('Clipboard API 실패 시 직접 복사할 초대 URL을 그대로 반환한다', async () => {
  const clipboard = { writeText: async () => { throw new Error('denied') } }
  const url = 'https://oneulwhere.kr/couple/r/507e4e3ca40a5500#invite=secret-value'

  const result = await copyText(url, clipboard)

  assert.deepEqual(result, { mode: 'manual', status: 'manual', text: url })
})

test('결과 공유에는 공개 Couple 랜딩 주소만 포함한다', () => {
  const result = {
    agreementScore: 85,
    publicCode: 'deadbeefdeadbeef',
    inviteSecret: 'do-not-share-this-secret',
    rawAnswers: [{ activity: 'cafe' }],
    items: [{ place: { name: '[Fixture] 서울숲 대화 카페' } }],
  }

  const payload = buildSafeResultShare(result)
  const serialized = JSON.stringify(payload)

  assert.equal(payload.url, SAFE_COUPLE_URL)
  assert.match(payload.text, /85%/)
  assert.match(payload.text, /오늘의 취향 겹침/)
  assert.doesNotMatch(payload.text, /취향 일치도/)
  assert.match(payload.text, /서울숲 대화 카페/)
  assert.doesNotMatch(payload.text, /Fixture/)
  assert.doesNotMatch(serialized, /couple\/r\//)
  assert.doesNotMatch(serialized, /deadbeefdeadbeef/)
  assert.doesNotMatch(serialized, /do-not-share-this-secret/)
  assert.doesNotMatch(serialized, /rawAnswers|activity/)
})

test('결과가 일부 비어 있어도 안전한 기본 요약을 만든다', () => {
  const payload = buildSafeResultShare(null)
  assert.equal(payload.url, SAFE_COUPLE_URL)
  assert.match(payload.text, /0%/)
  assert.match(payload.text, /오늘의 장소/)
})

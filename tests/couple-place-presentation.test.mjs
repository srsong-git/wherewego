import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getDisplayPlaceDescription,
  getDisplayPlaceName,
  toDisplayPlace,
} from '../src/couple/placePresentation.js'

test('표시용 장소명은 선행 Fixture 접두어와 뒤 공백만 제거한다', () => {
  assert.equal(getDisplayPlaceName('[Fixture] 새활용 문화 체험'), '새활용 문화 체험')
  assert.equal(getDisplayPlaceName('플로디스튜디오'), '플로디스튜디오')
  assert.equal(getDisplayPlaceName('장소 [Fixture] 별관'), '장소 [Fixture] 별관')
  assert.equal(getDisplayPlaceName('[Fixture]공백 없는 이름'), '[Fixture]공백 없는 이름')
})

test('카드·상세·지도에 전달할 표시용 장소는 원본 snapshot을 변경하지 않는다', () => {
  const original = {
    id: 'fixture-test',
    name: '[Fixture] 새활용 문화 체험',
    description: '개발용 체험 fixture예요.',
  }
  const snapshot = structuredClone(original)
  const displayed = toDisplayPlace(original, { datasetVersion: 'couple-fixture-v1' })

  assert.notEqual(displayed, original)
  assert.equal(displayed.name, '새활용 문화 체험')
  assert.equal(displayed.description, '')
  assert.deepEqual(original, snapshot)
})

test('fixture 설명에서는 확인된 내부 문장만 제거하고 정상 문장을 보존한다', () => {
  const description = '둘이 천천히 전시를 볼 수 있어요. 개발용 체험 fixture예요.'

  assert.equal(
    getDisplayPlaceDescription(description, 'couple-fixture-v1'),
    '둘이 천천히 전시를 볼 수 있어요.',
  )
  assert.equal(
    getDisplayPlaceDescription('개발용 체험 fixture예요', 'couple-fixture-v1'),
    '',
  )
})

test('production 설명은 공백과 줄바꿈까지 원문 그대로 유지한다', () => {
  const description = '  실제  장소 설명입니다.\n둘째 줄입니다.  '

  assert.equal(
    getDisplayPlaceDescription(description, 'couple-production-phase1b2b-v1'),
    description,
  )
})

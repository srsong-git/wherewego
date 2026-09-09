const sharedPointRules = [
  [/비싼 곳 제외|1인 2만원 이하/, '너무 비싸지 않은 곳'],
  [/1인 4만원 이하/, '부담스럽지 않은 예산의 곳'],
  [/쉬고 싶음/, '편하게 쉬어갈 수 있는 곳'],
  [/적당히 움직이기/, '부담 없이 즐길 수 있는 곳'],
  [/활동적으로 보내기/, '함께 움직이며 즐길 수 있는 곳'],
  [/적당히 새로운 곳/, '익숙하면서도 작은 발견이 있는 곳'],
  [/검증된 곳/, '실패 걱정이 적은 익숙한 곳'],
  [/신상·특별한 곳/, '평소와 다른 특별한 곳'],
  [/카페 제외/, '카페 말고 다른 즐길 거리'],
  [/전시·팝업/, '전시나 팝업을 함께 보는 것'],
  [/체험·놀거리/, '함께 직접 해보는 활동'],
  [/산책·문화공간/, '천천히 걷거나 문화공간을 둘러보는 것'],
  [/카페/, '카페에서 여유롭게 보내는 것'],
  [/야외는 피하기/, '날씨 걱정 없이 즐길 수 있는 곳'],
  [/많이 걷지 않기/, '많이 걷지 않아도 되는 곳'],
  [/긴 웨이팅 피하기/, '오래 기다리지 않는 곳'],
  [/자동차가 필요한 곳 제외/, '차 없이 가기 편한 곳'],
  [/같은 권역/, '같은 동네에서 부담 없이 만나는 것'],
]

const differencePhrases = [
  ['활동은 아무거나', '활동 종류에 크게 상관없는'],
  ['산책·문화공간', '천천히 걷거나 문화공간을 둘러보는'],
  ['체험·놀거리', '함께 직접 해보는 활동을 원하는'],
  ['전시·팝업', '새로운 볼거리를 찾는'],
  ['카페', '카페에서 여유롭게 보내는'],
  ['활동적으로 보내기', '활동적으로 시간을 보내는'],
  ['적당히 움직이기', '가볍게 움직이는'],
  ['쉬고 싶음', '편하게 쉬는'],
  ['신상·특별한 곳', '신상이나 특별한 곳을 찾는'],
  ['적당히 새로운 곳', '조금 새로운 곳을 찾는'],
  ['검증된 곳', '익숙하고 검증된 곳을 찾는'],
]

const categoryBenefit = {
  cafe: '대화를 나누며 여유롭게 머물기 좋고',
  exhibition: '함께 볼거리와 이야깃거리를 즐기기 좋고',
  popup: '새로운 볼거리를 가볍게 즐기기 좋고',
  experience: '둘이 함께 직접 해보는 재미가 있고',
  entertainment: '함께 움직이며 웃을 거리가 있고',
  culture: '천천히 둘러보며 시간을 보내기 좋고',
  walk: '나란히 걸으며 이야기하기 좋고',
}

export function getAgreementMessage(score) {
  const value = Number(score) || 0
  if (value >= 80) return '오늘은 거의 같은 생각이에요 💕'
  if (value >= 60) return '오늘은 꽤 잘 맞아요 😊'
  if (value >= 40) return '오늘은 취향이 조금 갈렸어요 😄'
  return '오늘은 취향이 꽤 갈렸어요 👀'
}

export function getSharedPointCopy(point) {
  const matched = sharedPointRules.find(([pattern]) => pattern.test(point))
  if (matched) return matched[1]
  return point
    .replace(/^둘 다 /, '')
    .replace(/(?:을|를) (?:원했어요|선호했어요|생각했어요)$/, '')
    .replace(/해요$/, '하는 것')
}

export function getDifferencePointCopy(point) {
  if (point.startsWith('예산은')) return '두 사람이 생각한 예산대가 조금 달라요. 더 부담 없는 쪽을 기준으로 봤어요.'
  if (point.startsWith('가능 시간은')) return '함께 보낼 수 있는 시간이 조금 달라요. 더 여유가 적은 쪽에 맞췄어요.'

  const phrases = differencePhrases
    .filter(([label]) => point.includes(label))
    .map(([, phrase]) => phrase)
  if (phrases.length >= 2) return `한 사람은 ${phrases[0]} 쪽이고, 다른 사람은 ${phrases[1]} 쪽이에요.`

  return point.replaceAll('다른 한 분', '다른 사람').replaceAll('한 분', '한 사람')
}

export function getCompromiseCopy(result) {
  const place = result?.items?.[0]?.place
  if (!place) return '둘이 정한 조건을 몰래 바꾸지 않고, 함께 받아들일 수 있는 선택을 찾았어요.'
  if (place.energy === 'low') return '편하게 머물 수 있으면서도 둘 다 즐길 포인트가 있는 곳을 골랐어요.'
  if (place.energy === 'high') return '함께 움직이는 재미가 있으면서도 한쪽만 무리하지 않는 곳을 골랐어요.'
  if (place.novelty === 'new') return '가볍게 즐길 수 있으면서도 평소와는 조금 다른 곳을 골랐어요.'
  return '한쪽의 취향에만 치우치지 않으면서, 둘이 정한 예산과 시간을 함께 지킬 수 있는 곳을 골랐어요.'
}

export function getPrimaryRecommendationReason(place) {
  const benefit = categoryBenefit[place?.category] || '둘이 부담 없이 함께 즐기기 좋고'
  return `${benefit} 둘이 정한 예산과 시간을 함께 지킬 수 있는 곳이에요.`
}

export function getAlternativeLead(place, alternativeIndex) {
  if (alternativeIndex === 0) {
    if (place?.energy === 'low') return '조금 더 편하게 보내고 싶다면'
    if (place?.energy === 'high') return '조금 더 활동적으로 보내고 싶다면'
    if (place?.category === 'cafe') return '대화를 조금 더 오래 나누고 싶다면'
    if (['exhibition', 'popup'].includes(place?.category)) return '새로운 볼거리를 더 즐기고 싶다면'
    return '분위기를 살짝 바꿔보고 싶다면'
  }

  if (place?.novelty === 'new') return '조금 더 특별한 분위기를 원한다면'
  if (['walk', 'culture'].includes(place?.category)) return '천천히 둘러보는 시간을 원한다면'
  if (place?.waitRisk === 'low') return '기다림을 조금 더 줄이고 싶다면'
  if (place?.budgetPerPerson <= 10000) return '예산을 조금 더 가볍게 쓰고 싶다면'
  return '다른 매력도 함께 비교해보고 싶다면'
}

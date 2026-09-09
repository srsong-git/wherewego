export const meetingAreas = [
  { value: 'seongsu', title: '성수·서울숲', description: '전시와 카페, 서울숲 산책까지' },
  { value: 'hongdae', title: '홍대·연남', description: '공방과 문화공간, 골목 산책까지' },
  { value: 'jongno_euljiro', title: '종로·을지로', description: '전시와 오래된 골목, 도심 산책까지' },
]

export const meetingAreaMap = Object.fromEntries(meetingAreas.map((area) => [area.value, area]))

export const preferenceQuestions = [
  {
    key: 'activity',
    eyebrow: '오늘 뭐 하고 싶어요?',
    title: '가장 끌리는 활동은?',
    helper: '한 가지만 골라주세요. 상대방의 선택은 아직 보이지 않아요.',
    options: [
      { value: 'cafe', label: '☕ 카페' },
      { value: 'exhibition_popup', label: '🖼️ 전시·팝업' },
      { value: 'experience', label: '🧩 체험·놀거리' },
      { value: 'walk_culture', label: '🌿 산책·문화공간' },
      { value: 'any', label: '✨ 아무거나 좋아요' },
    ],
  },
  {
    key: 'energy',
    eyebrow: '지금 컨디션은?',
    title: '오늘 쓸 수 있는 에너지',
    helper: '지금의 솔직한 컨디션으로 골라주세요.',
    options: [
      { value: 'low', label: '🛋️ 쉬고 싶어요' },
      { value: 'medium', label: '🚶 적당히 움직일래요' },
      { value: 'high', label: '🎯 활동적으로 보낼래요' },
    ],
  },
  {
    key: 'novelty',
    eyebrow: '익숙함 vs 새로움',
    title: '어떤 발견을 원하세요?',
    helper: '유명한 곳이 편한지, 새로운 곳이 설레는지 골라주세요.',
    options: [
      { value: 'proven', label: '👍 익숙하고 검증된 곳' },
      { value: 'balanced', label: '🌱 적당히 새로운 곳' },
      { value: 'new', label: '✨ 신상·특별한 곳' },
    ],
  },
  {
    key: 'budget',
    eyebrow: '현실 조건도 중요해요',
    title: '1인 예산은 어느 정도예요?',
    helper: '입장료나 기본 이용 비용을 기준으로 생각해 주세요.',
    options: [
      { value: 'under_20000', label: '💸 2만원 이하' },
      { value: 'under_40000', label: '💳 4만원 이하' },
      { value: 'any', label: '🙌 상관없어요' },
    ],
  },
  {
    key: 'duration',
    eyebrow: '마지막 질문이에요',
    title: '함께 보낼 수 있는 시간은?',
    helper: '절대 싫은 조건도 최대 두 개까지 표시할 수 있어요.',
    options: [
      { value: '120', label: '⏱️ 1~2시간' },
      { value: '240', label: '🕓 3~4시간' },
      { value: 'unlimited', label: '🌙 시간은 넉넉해요' },
    ],
  },
]

export const vetoOptions = [
  { value: 'outdoor', label: '야외는 싫어요' },
  { value: 'long_walk', label: '많이 걷기 싫어요' },
  { value: 'long_wait', label: '긴 웨이팅 싫어요' },
  { value: 'cafe', label: '카페는 싫어요' },
  { value: 'high_cost', label: '비싼 곳은 싫어요' },
  { value: 'car_required', label: '차가 필요한 곳은 싫어요' },
]

export const categoryLabels = {
  cafe: '카페',
  exhibition: '전시',
  popup: '팝업',
  experience: '체험',
  entertainment: '놀거리',
  culture: '문화공간',
  walk: '산책',
  restaurant: '식당',
}

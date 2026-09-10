import { useEffect, useState } from 'react'

const themeVisuals = {
  놀이: ['🎢', '놀이와 웃음'],
  과학: ['🔭', '호기심 탐험'],
  '미술·전시': ['🎨', '예술 산책'],
  '역사·박물관': ['🏛️', '시간 여행'],
  '자연·산책': ['🌳', '자연 속 하루'],
  동물: ['🐾', '생명과 만남'],
  '책·도서관': ['📚', '책과 쉼'],
  체험: ['🧩', '직접 해보는 하루'],
  쇼핑: ['🛍️', '편안한 나들이'],
  '물놀이·스포츠': ['🏊', '신나는 움직임'],
}

function fallbackVisual(place) {
  return themeVisuals[place.themes[0]] || ['👟', '오늘의 나들이']
}

export default function PlaceImage({ place, variant = 'card', eager = false }) {
  const [emoji, label] = fallbackVisual(place)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => setLoadFailed(false), [place.id, place.image?.src])

  if (!place.image?.src || place.image.localHostingAllowed !== true || loadFailed) {
    return (
      <div className={`place-image place-image-${variant} fallback theme-${place.themes[0] || 'default'}`} role="img" aria-label={`${place.name} ${label} 이미지 준비 중`}>
        <span aria-hidden="true">{emoji}</span>
        <small>{label}</small>
      </div>
    )
  }

  return (
    <figure className={`place-image place-image-${variant}`}>
      <img src={place.image.src} alt={place.image.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setLoadFailed(true)} />
      <figcaption>
        사진: <a href={place.image.sourceUrl} target="_blank" rel="noreferrer">{place.image.sourceName}</a>
        {place.image.licenseUrl && <> · <a href={place.image.licenseUrl} target="_blank" rel="noreferrer">라이선스</a></>}
      </figcaption>
    </figure>
  )
}

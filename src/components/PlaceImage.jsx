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
  const preservesOriginal = place.image?.preserveOriginal === true
  const isTourApiImage = Boolean(place.image?.tourApiContentId)
  const tourApiLicenseLabel = preservesOriginal ? '공공누리 3유형' : '공공누리 1유형'
  const sourceName = isTourApiImage ? '한국관광공사' : place.image?.sourceName

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
    <>
      <figure className={`place-image place-image-${variant}${preservesOriginal ? ' no-derivatives' : ''}`}>
        <img src={place.image.src} alt={place.image.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setLoadFailed(true)} />
        <figcaption>
          사진: <a href={place.image.sourceUrl} target="_blank" rel="noreferrer">{sourceName}</a>
          {place.image.licenseUrl && <> · <a href={place.image.licenseUrl} target="_blank" rel="noreferrer">{isTourApiImage ? tourApiLicenseLabel : place.image.licenseLabel || '라이선스'}</a></>}
        </figcaption>
      </figure>
      {isTourApiImage && variant === 'modal' && (
        <details className="place-image-license-details">
          <summary>ⓘ 사진정보</summary>
          <p>{place.image.attributionText}</p>
          <p>{place.image.publishedYear ? `${place.image.publishedYear}년 발행` : `${place.image.verifiedAt?.slice(0, 4)}년 이용조건 확인`} · 제공기관 한국관광공사</p>
          {place.image.author && <p>저작자: {place.image.author}</p>}
          <p>{preservesOriginal ? '원본 파일의 비율과 내용을 변경하지 않고 표시하고 있어요.' : '카드 표시에 맞게 crop·resize 및 WebP 변환한 이미지예요.'}</p>
          <div>
            <a href={place.image.sourceUrl} target="_blank" rel="noreferrer">원본 이미지</a>
            <a href={place.image.licenseUrl} target="_blank" rel="noreferrer">{preservesOriginal ? '공공누리 제3유형' : '공공누리 제1유형'}</a>
            {place.image.sourcePolicyUrl && <a href={place.image.sourcePolicyUrl} target="_blank" rel="noreferrer">한국관광공사 저작권 정책</a>}
          </div>
          <small>{place.image.verifiedAt} 확인</small>
        </details>
      )}
    </>
  )
}

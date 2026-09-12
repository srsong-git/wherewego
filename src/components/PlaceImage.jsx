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

function getWikimediaAuthor(image) {
  if (image.author) return image.author
  if (!image.sourceName?.includes('Wikimedia Commons')) return null
  return image.sourceName.split('· Wikimedia Commons')[0].trim() || null
}

function getLicenseLabel(image, isTourApiImage, preservesOriginal) {
  if (isTourApiImage) return preservesOriginal ? '공공누리 3유형' : '공공누리 1유형'
  if (image.licenseLabel) return image.licenseLabel
  return image.licenseOrUsageBasis?.split(':')[0]?.trim() || '라이선스'
}

function getModificationNote(image, isTourApiImage, preservesOriginal) {
  if (preservesOriginal) return '원본 파일의 비율과 내용을 변경하지 않고 표시하고 있어요.'
  if (isTourApiImage) return '카드 표시에 맞게 crop·resize하고 WebP로 변환한 이미지예요.'
  if (/crop|cropped/i.test(image.attributionText || image.sourceName || '')) {
    return '원본을 카드 비율에 맞게 crop하고 WebP로 변환한 이미지예요.'
  }
  return '이미지 변경 여부는 원본 출처와 이용조건을 함께 확인해 주세요.'
}

export default function PlaceImage({ place, variant = 'card', eager = false, onOpenInfo, infoInitiallyOpen = false }) {
  const [emoji, label] = fallbackVisual(place)
  const [loadFailed, setLoadFailed] = useState(false)
  const preservesOriginal = place.image?.preserveOriginal === true
  const isTourApiImage = Boolean(place.image?.tourApiContentId)
  const imageAuthor = getWikimediaAuthor(place.image || {})
  const licenseLabel = getLicenseLabel(place.image || {}, isTourApiImage, preservesOriginal)
  const compactAttribution = isTourApiImage
    ? `ⓒ 한국관광공사${place.image?.author ? ` · ${place.image.author}` : ''}`
    : 'ⓘ 사진정보'

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
          {onOpenInfo ? (
            <button
              type="button"
              aria-label={`${place.name} 사진정보 보기`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenInfo()
              }}
            >
              {compactAttribution}
            </button>
          ) : <span>{compactAttribution}</span>}
        </figcaption>
      </figure>
      {variant === 'modal' && (
        <details className="place-image-license-details" open={infoInitiallyOpen}>
          <summary>ⓘ 사진정보</summary>
          {isTourApiImage ? (
            <>
              <p><strong>출처:</strong> 한국관광공사 TourAPI</p>
              {place.image.author && <p><strong>촬영자:</strong> {place.image.author}</p>}
              <p>{place.image.attributionText}</p>
              <p>{place.image.publishedYear ? `${place.image.publishedYear}년 발행` : `${place.image.verifiedAt?.slice(0, 4)}년 이용조건 확인`} · 제공기관 한국관광공사</p>
            </>
          ) : (
            <>
              {imageAuthor && <p><strong>저작자:</strong> {imageAuthor}</p>}
              <p><strong>원본 출처:</strong> Wikimedia Commons</p>
              <p>{place.image.attributionText}</p>
            </>
          )}
          <p><strong>이용조건:</strong> {place.image.licenseOrUsageBasis}</p>
          <p><strong>변경 여부:</strong> {getModificationNote(place.image, isTourApiImage, preservesOriginal)}</p>
          <div>
            <a href={place.image.sourceUrl} target="_blank" rel="noreferrer">원본 보기</a>
            {place.image.licenseUrl && <a href={place.image.licenseUrl} target="_blank" rel="noreferrer">{licenseLabel}</a>}
            {isTourApiImage && place.image.sourcePolicyUrl && <a href={place.image.sourcePolicyUrl} target="_blank" rel="noreferrer">한국관광공사 저작권 정책</a>}
          </div>
          <small>{place.image.verifiedAt} 확인</small>
        </details>
      )}
    </>
  )
}

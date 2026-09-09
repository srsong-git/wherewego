import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { getKakaoDirectionsLinks, getKakaoMapLink, getKakaoPlaceDetailLink } from '../utils/kakaoLinks.js'
import { categoryLabels } from './config.js'
import {
  getAgreementMessage,
  getAlternativeLead,
  getCompromiseCopy,
  getDifferencePointCopy,
  getPrimaryRecommendationReason,
  getSharedPointCopy,
} from './resultPresentation.js'
import { toDisplayPlace } from './placePresentation.js'
import { buildSafeResultShare, sharePayload } from './share.js'

const KakaoMap = lazy(() => import('../components/KakaoMap.jsx'))

function formatBudget(value) {
  if (!value) return '무료'
  return `1인 약 ${value.toLocaleString('ko-KR')}원 이하`
}

export function CouplePlaceModal({ place, onClose }) {
  const modalRef = useRef(null)
  const closeRef = useRef(null)
  const directions = getKakaoDirectionsLinks(place)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [onClose])

  return (
    <div className="couple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="couple-place-modal" role="dialog" aria-modal="true" aria-labelledby="couple-place-title" ref={modalRef}>
        <div className="couple-modal-scroll">
          <div className="couple-modal-top"><span className="fixture-badge">추천 장소</span><button type="button" aria-label="장소 상세 닫기" onClick={onClose} ref={closeRef}>×</button></div>
          <p className="couple-eyebrow dark">{categoryLabels[place.category] || place.category}</p>
          <h2 id="couple-place-title">{place.name}</h2>
          {place.description && <p className="couple-place-description">{place.description}</p>}
          <dl className="couple-place-facts">
            <div><dt>📍 위치</dt><dd>{place.area}<small>{place.address}</small></dd></div>
            <div><dt>💰 예산</dt><dd>{formatBudget(place.budgetPerPerson)}</dd></div>
            <div><dt>⏱ 시간</dt><dd>약 {place.durationMinutes}분</dd></div>
            <div><dt>🚶 걷기</dt><dd>{place.walkingLevel === 'low' ? '적음' : place.walkingLevel === 'medium' ? '보통' : '많음'}</dd></div>
            <div><dt>⏳ 웨이팅</dt><dd>{place.waitRisk === 'low' ? '낮음' : place.waitRisk === 'medium' ? '보통' : '높음'}</dd></div>
          </dl>
          <div className="fixture-warning"><strong>방문 전 확인해 주세요</strong><p>운영 시간, 예약, 가격 정보는 바뀔 수 있어요. 카카오맵에서 최신 정보를 확인해 주세요.</p><a href={getKakaoPlaceDetailLink(place)} target="_blank" rel="noreferrer">카카오맵 최신 정보 확인 ↗</a></div>
        </div>
        <div className="couple-modal-actions">
          <a className="route" href={directions.primaryUrl} target="_blank" rel="noreferrer">🧭 길찾기</a>
          <a href={getKakaoMapLink(place)} target="_blank" rel="noreferrer">📍 지도 보기</a>
        </div>
      </section>
    </div>
  )
}

function ResultPlaceCard({ item, primary, alternativeIndex = 0, onOpen }) {
  const place = item.place
  const reason = primary
    ? getPrimaryRecommendationReason(place)
    : getAlternativeLead(place, alternativeIndex)
  return (
    <article className={primary ? 'couple-result-place primary' : 'couple-result-place'}>
      <div className="result-place-top"><span>{primary ? '✨ 오늘의 강력추천' : `대안 ${item.rank - 1}`}</span><small>{primary ? '1순위' : '다른 선택'}</small></div>
      <h3>{place.name}</h3>
      <div className="result-place-tags"><span>{categoryLabels[place.category] || place.category}</span><span>{formatBudget(place.budgetPerPerson)}</span><span>약 {place.durationMinutes}분</span></div>
      <p className={primary ? 'result-place-reason' : 'alternative-reason'}>{reason}</p>
      <button type="button" onClick={() => onOpen(place)}>장소 자세히 보기 <span aria-hidden="true">→</span></button>
    </article>
  )
}

export default function CoupleResult({ roomState }) {
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [shareNotice, setShareNotice] = useState('')
  const [manualText, setManualText] = useState('')
  const result = roomState.result
  const agreementMessage = getAgreementMessage(result.agreementScore)
  const sharedPoints = result.sharedPoints.map(getSharedPointCopy)
  const differencePoints = result.differencePoints.map(getDifferencePointCopy)
  const compromiseCopy = getCompromiseCopy(result)
  const displayItems = useMemo(() => result.items.map((item) => ({
    ...item,
    place: toDisplayPlace(item.place, { datasetVersion: result.datasetVersion }),
  })), [result.datasetVersion, result.items])
  const mapItems = useMemo(() => displayItems.map((item, recommendationIndex) => ({ place: item.place, recommendationIndex, distance: null })), [displayItems])

  const shareResult = async () => {
    const shared = await sharePayload(buildSafeResultShare(result))
    if (shared.status === 'shared') setShareNotice('안전한 결과 요약 공유창을 열었어요.')
    if (shared.status === 'copied') setShareNotice('결과 요약과 /couple 링크를 복사했어요.')
    if (shared.status === 'cancelled') setShareNotice('공유를 취소했어요.')
    if (shared.status === 'manual') {
      setManualText(shared.text)
      setShareNotice('아래 안전한 결과 요약을 직접 복사해 주세요.')
    }
  }

  return (
    <main className="result-main" aria-live="polite">
      <section className="consensus-summary">
        <p className="couple-eyebrow dark">오늘 입력한 취향을 비교했어요</p>
        <h1 className="agreement-message">{agreementMessage}</h1>
        <p className="agreement-score">오늘의 취향 겹침 <strong>{result.agreementScore}%</strong></p>
        <p className="agreement-caption">연애 궁합이 아니라, 오늘 고른 다섯 가지 조건이 얼마나 겹쳤는지 보여줘요.</p>
        <div className="consensus-columns">
          <section><h2>둘 다 원하는 건</h2><ul>{sharedPoints.map((point, index) => <li key={`${point}-${index}`}>✓ {point}</li>)}</ul></section>
          <section><h2>오늘 조금 달랐던 건</h2>{differencePoints.length ? <ul>{differencePoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul> : <p>오늘은 중요한 선택이 꽤 비슷했어요.</p>}</section>
        </div>
        <div className="compromise-box"><span aria-hidden="true">🪄</span><div><h2>그래서 이렇게 골랐어요</h2><p><strong>{compromiseCopy}</strong></p></div></div>
        <button className="safe-share-button" type="button" onClick={shareResult}>결과 공유하기 <span aria-hidden="true">↗</span></button>
        <small className="safe-share-guide">비밀 방 URL과 개인 응답은 공유하지 않아요.</small>
        {shareNotice && <p className="share-notice" role="status">{shareNotice}</p>}
        {manualText && <textarea className="manual-share" readOnly value={manualText} aria-label="직접 복사할 안전한 결과 요약" onFocus={(event) => event.currentTarget.select()} />}
      </section>

      <section className="result-places" aria-labelledby="recommended-place-title">
        <div className="couple-section-heading left"><p>오늘의 추천</p><h2 id="recommended-place-title">오늘 둘에게 가장 잘 맞는 곳</h2><span>강력추천 한 곳과 서로 다른 매력의 대안 두 곳만 보여드려요.</span></div>
        <ResultPlaceCard item={displayItems[0]} primary onOpen={setSelectedPlace} />
        {displayItems.length > 1 && <div className="alternative-grid">{displayItems.slice(1).map((item, alternativeIndex) => <ResultPlaceCard item={item} alternativeIndex={alternativeIndex} onOpen={setSelectedPlace} key={item.placeId} />)}</div>}
      </section>

      <section className="couple-map-section" aria-labelledby="couple-map-title">
        <div className="couple-section-heading left"><p>지도에서 보기</p><h2 id="couple-map-title">추천 장소 위치</h2></div>
        <Suspense fallback={<div className="map-skeleton">지도를 준비하는 중…</div>}>
          <KakaoMap items={mapItems} userLocation={null} onOpenPlace={setSelectedPlace} />
        </Suspense>
      </section>
      <p className="fixture-notice result-fixture">방문 전 장소 운영 여부와 예약·가격의 최신 정보를 확인해 주세요.</p>
      {selectedPlace && <CouplePlaceModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />}
    </main>
  )
}

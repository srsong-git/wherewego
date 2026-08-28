import { useEffect } from 'react'
import { kakaoPriorityReviewNames, places } from '../data/places.js'
import { getKakaoMapLink, getKakaoPlaceDetailLink } from '../utils/kakaoLinks.js'

const DESKTOP_DEVICE = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138 Safari/537.36',
  maxTouchPoints: 0,
}

const MOBILE_DEVICE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
}

const priorityReviewNameSet = new Set(kakaoPriorityReviewNames)

function normalizePlaceName(value) {
  return String(value || '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase()
}

function getStatuses(place) {
  const statuses = []
  const hasId = Boolean(place.kakaoPlaceId)
  const hasUrl = Boolean(place.kakaoPlaceUrl)
  const connectionNameDiffers = normalizePlaceName(place.kakaoPlaceName) !== normalizePlaceName(place.name)

  if (place.kakaoNeedsReview) statuses.push({ key: 'review', label: '수동 확인 필요', tone: 'danger' })
  if (!hasId) statuses.push({ key: 'id', label: 'ID 없음', tone: 'warning' })
  if (!hasUrl) statuses.push({ key: 'url', label: 'URL 없음', tone: 'warning' })
  if (connectionNameDiffers) statuses.push({ key: 'name', label: '연결명 확인', tone: 'info' })
  if (hasId && hasUrl) statuses.push({ key: 'ready', label: '확인 가능', tone: 'success' })
  if (place.kakaoVerified) statuses.push({ key: 'verified', label: '기존 검증 기록', tone: 'neutral' })

  return statuses
}

function UrlCell({ url, label }) {
  if (!url) return <span className="kakao-debug-empty">생성 불가</span>

  return (
    <div className="kakao-debug-url-cell">
      <code title={url}>{url}</code>
      <a href={url} target="_blank" rel="noreferrer">{label}</a>
    </div>
  )
}

export default function KakaoLinksDebugPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = '카카오맵 링크 검증 | 오늘 어디가지?'
    return () => { document.title = previousTitle }
  }, [])

  const priorityPlaces = places.filter((place) => (
    !place.kakaoPlaceId || !place.kakaoPlaceUrl || place.kakaoNeedsReview
  ))
  const namedPriorityPlaces = places.filter((place) => priorityReviewNameSet.has(place.name))
  const incompletePlaces = places.filter((place) => !place.kakaoPlaceId || !place.kakaoPlaceUrl)
  const currentNames = new Set(places.map((place) => place.name))
  const missingPriorityNames = kakaoPriorityReviewNames.filter((name) => !currentNames.has(name))
  const idReadyCount = places.filter((place) => place.kakaoPlaceId && place.kakaoPlaceUrl).length
  const verifiedCount = places.filter((place) => place.kakaoVerified).length

  return (
    <main className="kakao-debug">
      <header className="kakao-debug-header">
        <div>
          <p className="kakao-debug-eyebrow">DEVELOPMENT TOOL</p>
          <h1>카카오맵 링크 검증</h1>
          <p>장소별 PC·모바일 링크와 카카오 장소 데이터를 한 화면에서 점검합니다. 일반 서비스 화면에는 이 페이지 링크가 노출되지 않습니다.</p>
        </div>
        <a className="kakao-debug-home" href="/">일반 화면으로 돌아가기</a>
      </header>

      <section className="kakao-debug-summary" aria-label="카카오 장소 데이터 요약">
        <div><strong>{places.length}</strong><span>전체 장소</span></div>
        <div><strong>{idReadyCount}</strong><span>ID·URL 등록</span></div>
        <div><strong>{verifiedCount}</strong><span>기존 검증 기록</span></div>
        <div><strong>{priorityPlaces.length}</strong><span>우선 수동 확인</span></div>
      </section>

      <section className="kakao-debug-priority" aria-labelledby="priority-title">
        <div className="kakao-debug-section-heading">
          <div>
            <p className="kakao-debug-eyebrow">PRIORITY REVIEW</p>
            <h2 id="priority-title">우선 수동 검증이 필요한 장소</h2>
          </div>
          <span>{priorityPlaces.length}곳</span>
        </div>
        <p>ID 또는 URL이 없거나, 대형 복합시설 등으로 <code>kakaoNeedsReview</code>가 설정된 장소입니다.</p>
        <details open>
          <summary>대형·복합시설 우선 대상 {namedPriorityPlaces.length}곳</summary>
          <div className="kakao-debug-name-list">
            {namedPriorityPlaces.map((place) => <span key={place.id}>{place.name}</span>)}
          </div>
        </details>
        <details>
          <summary>ID 또는 URL 미등록 {incompletePlaces.length}곳</summary>
          <div className="kakao-debug-name-list">
            {incompletePlaces.map((place) => <span key={place.id}>{place.name}</span>)}
          </div>
        </details>
        {missingPriorityNames.length > 0 ? (
          <div className="kakao-debug-missing">
            <strong>요청 목록 중 현재 장소 데이터에 없는 항목</strong>
            <p>{missingPriorityNames.join(' · ')}</p>
          </div>
        ) : null}
      </section>

      <section className="kakao-debug-table-section" aria-labelledby="all-links-title">
        <div className="kakao-debug-section-heading">
          <div>
            <p className="kakao-debug-eyebrow">ALL PLACES</p>
            <h2 id="all-links-title">전체 장소 링크</h2>
          </div>
          <span>{places.length}곳</span>
        </div>
        <div className="kakao-debug-table-wrap" tabIndex="0" aria-label="전체 장소 카카오 링크 표, 가로로 스크롤할 수 있습니다">
          <table>
            <caption>오늘 어디가지 장소별 카카오맵 연결 데이터</caption>
            <thead>
              <tr>
                <th scope="col">서비스 표시명</th>
                <th scope="col">카카오 연결명</th>
                <th scope="col">Place ID</th>
                <th scope="col">Place URL</th>
                <th scope="col">검증됨</th>
                <th scope="col">재검토</th>
                <th scope="col">PC 지도보기 URL</th>
                <th scope="col">모바일 지도보기 URL</th>
                <th scope="col">최신 장소정보 URL</th>
                <th scope="col">좌표</th>
                <th scope="col">주소</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => {
                const desktopMapUrl = getKakaoMapLink(place, DESKTOP_DEVICE)
                const mobileMapUrl = getKakaoMapLink(place, MOBILE_DEVICE)
                const placeInfoUrl = getKakaoPlaceDetailLink(place)
                const statuses = getStatuses(place)

                return (
                  <tr key={place.id}>
                    <th scope="row">{place.name}</th>
                    <td>{place.kakaoPlaceName || <span className="kakao-debug-empty">미등록</span>}</td>
                    <td><strong>{place.kakaoPlaceId || <span className="kakao-debug-empty">ID 없음</span>}</strong></td>
                    <td><small>{place.kakaoPlaceUrl || <span className="kakao-debug-empty">URL 없음</span>}</small></td>
                    <td>{place.kakaoVerified ? 'true' : 'false'}</td>
                    <td>{place.kakaoNeedsReview ? 'true' : 'false'}</td>
                    <td><UrlCell url={desktopMapUrl} label="PC 지도보기 열기" /></td>
                    <td><UrlCell url={mobileMapUrl} label="모바일 장소 열기" /></td>
                    <td><UrlCell url={placeInfoUrl} label="최신정보 열기" /></td>
                    <td><code>{place.latitude}, {place.longitude}</code></td>
                    <td>{place.address || <><span className="kakao-debug-empty">주소 미등록</span><small>지역: {place.area}</small></>}</td>
                    <td>
                      <div className="kakao-debug-statuses">
                        {statuses.map((status) => (
                          <span className={`kakao-debug-status ${status.tone}`} key={status.key}>{status.label}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

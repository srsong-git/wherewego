import { useEffect, useRef, useState } from 'react'
import { loadKakaoSdk } from '../utils/kakaoSdk.js'

function normalizePlaceResult(place) {
  return {
    id: place.id || `${place.x}-${place.y}`,
    label: place.place_name || place.address_name,
    address: place.road_address_name || place.address_name || '',
    category: place.category_group_name || place.category_name?.split(' > ').at(-1) || '',
    latitude: Number(place.y),
    longitude: Number(place.x),
  }
}

export default function FamilyLocationSearch({ origin, locationStatus, onUseCurrentLocation, onSelect, onClear }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)
  const requestIdRef = useRef(0)
  const appKey = import.meta.env.VITE_KAKAO_MAP_KEY

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus())
  }, [isOpen])

  const search = async (event) => {
    event.preventDefault()
    const keyword = query.trim()
    if (keyword.length < 2) {
      setMessage('장소나 지역 이름을 두 글자 이상 입력해 주세요.')
      setResults([])
      return
    }

    const requestId = ++requestIdRef.current
    setStatus('loading')
    setMessage('')
    setResults([])

    try {
      const maps = await loadKakaoSdk(appKey)
      const places = new maps.services.Places()
      const keywordResults = await new Promise((resolve, reject) => {
        places.keywordSearch(keyword, (data, searchStatus) => {
          if (searchStatus === maps.services.Status.OK) resolve(data)
          else if (searchStatus === maps.services.Status.ZERO_RESULT) resolve([])
          else reject(new Error('장소 검색에 실패했습니다.'))
        }, { size: 5 })
      })

      let candidates = keywordResults
      if (!candidates.length) {
        const geocoder = new maps.services.Geocoder()
        candidates = await new Promise((resolve, reject) => {
          geocoder.addressSearch(keyword, (data, searchStatus) => {
            if (searchStatus === maps.services.Status.OK) resolve(data)
            else if (searchStatus === maps.services.Status.ZERO_RESULT) resolve([])
            else reject(new Error('주소 검색에 실패했습니다.'))
          })
        })
      }

      if (requestId !== requestIdRef.current) return
      const normalized = candidates
        .map(normalizePlaceResult)
        .filter((item) => item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        .filter((item, index, list) => list.findIndex((candidate) => candidate.latitude === item.latitude && candidate.longitude === item.longitude) === index)
        .slice(0, 5)
      setResults(normalized)
      setMessage(normalized.length ? '정확한 장소를 골라 주세요.' : '검색 결과가 없어요. 동네나 역 이름을 다시 확인해 주세요.')
      setStatus('ready')
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setStatus('error')
      setMessage(error.message || '장소 검색을 잠시 사용할 수 없어요.')
    }
  }

  const selectResult = (item) => {
    onSelect({ type: 'searched', label: item.label, latitude: item.latitude, longitude: item.longitude })
    setIsOpen(false)
    setResults([])
    setMessage('')
  }

  return (
    <section className="family-location-search" aria-labelledby="family-location-title">
      <div className="location-row">
        <div>
          <strong id="family-location-title">📍 어디에서 출발하세요?</strong>
          <p>{origin ? <><b>{origin.label}</b> 기준으로 거리를 보여드려요.</> : '현재 위치를 허용하거나 원하는 지역을 직접 찾아보세요.'}</p>
        </div>
        <div className="location-actions">
          <button className={origin?.type === 'current' ? 'location-button active' : 'location-button'} type="button" onClick={onUseCurrentLocation} disabled={locationStatus === 'loading'}>
            {locationStatus === 'loading' ? '위치 확인 중…' : origin?.type === 'current' ? '✓ 현재 위치 사용 중' : '현재 위치 사용'}
          </button>
          <button className={origin?.type === 'searched' ? 'location-button secondary active' : 'location-button secondary'} type="button" aria-expanded={isOpen} aria-controls="family-location-search-panel" onClick={() => setIsOpen((current) => !current)}>
            {origin?.type === 'searched' ? '위치 변경' : '다른 위치에서 찾기'}
          </button>
          {origin && <button className="location-clear-button" type="button" onClick={onClear}>위치 지우기</button>}
        </div>
      </div>

      {isOpen && (
        <div className="family-location-search-panel" id="family-location-search-panel">
          <form onSubmit={search} role="search">
            <label htmlFor="family-location-query">장소·역·동네 검색</label>
            <div>
              <input ref={inputRef} id="family-location-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 판교역, 해운대, 제주공항" autoComplete="off" />
              <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? '검색 중…' : '검색'}</button>
            </div>
          </form>
          {message && <p className={status === 'error' ? 'location-search-message error' : 'location-search-message'} role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
          {results.length > 0 && (
            <ul className="family-location-results">
              {results.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => selectResult(item)}>
                    <strong>{item.label}</strong>
                    <span>{[item.category, item.address].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="location-search-privacy">검색어는 카카오 장소 검색에만 사용하며 오늘 어디가지? DB에는 저장하지 않아요.</p>
        </div>
      )}
    </section>
  )
}

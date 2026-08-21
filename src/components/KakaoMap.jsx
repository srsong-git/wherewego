import { useEffect, useRef, useState } from 'react'

const SDK_ID = 'kakao-map-sdk'
let kakaoSdkPromise

function loadKakaoSdk(appKey) {
  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(() => resolve(window.kakao.maps)))
  }

  if (kakaoSdkPromise) return kakaoSdkPromise

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(SDK_ID)
    const script = existingScript || document.createElement('script')

    const handleLoad = () => {
      if (!window.kakao?.maps) {
        reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'))
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao.maps))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', () => reject(new Error('카카오 지도 연결에 실패했습니다.')), { once: true })

    if (!existingScript) {
      script.id = SDK_ID
      script.async = true
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=clusterer`
      document.head.appendChild(script)
    }
  })

  return kakaoSdkPromise
}

export default function KakaoMap({ items, userLocation, onOpenPlace }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const appKey = import.meta.env.VITE_KAKAO_MAP_KEY

  useEffect(() => {
    if (!appKey) {
      setStatus('missing-key')
      return
    }

    let active = true
    setStatus('loading')
    loadKakaoSdk(appKey)
      .then(() => active && setStatus('ready'))
      .catch((error) => {
        if (!active) return
        setErrorMessage(error.message)
        setStatus('error')
      })

    return () => { active = false }
  }, [appKey])

  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || !window.kakao?.maps) return undefined

    const maps = window.kakao.maps
    const defaultCenter = new maps.LatLng(37.5665, 126.9780)
    const map = new maps.Map(containerRef.current, { center: defaultCenter, level: 9 })
    const bounds = new maps.LatLngBounds()
    const markers = items.map(({ place }) => {
      const position = new maps.LatLng(place.latitude, place.longitude)
      const marker = new maps.Marker({ position, title: place.name })
      maps.event.addListener(marker, 'click', () => onOpenPlace(place))
      bounds.extend(position)
      return marker
    })

    const clusterer = new maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 7,
      markers,
    })

    let userMarker
    let userLabel
    if (userLocation) {
      const userPosition = new maps.LatLng(userLocation.latitude, userLocation.longitude)
      userMarker = new maps.Marker({ map, position: userPosition, title: '내 위치', zIndex: 10 })

      const label = document.createElement('div')
      label.className = 'map-user-label'
      label.textContent = '내 위치'
      userLabel = new maps.CustomOverlay({ map, position: userPosition, content: label, yAnchor: 2.2, zIndex: 11 })
      bounds.extend(userPosition)
    }

    if (items.length || userLocation) {
      map.setBounds(bounds, 56, 56, 56, 56)
    }

    map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT)

    return () => {
      clusterer.clear()
      markers.forEach((marker) => marker.setMap(null))
      userMarker?.setMap(null)
      userLabel?.setMap(null)
      if (containerRef.current) containerRef.current.replaceChildren()
    }
  }, [items, onOpenPlace, status, userLocation])

  if (status === 'missing-key') {
    return (
      <div className="map-setup-card" role="status">
        <span aria-hidden="true">🗺️</span>
        <h3>카카오 지도 키를 연결해 주세요</h3>
        <p>지도 화면은 준비됐어요. 카카오 JavaScript 키와 사이트 도메인을 등록하면 장소 마커가 나타납니다.</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="map-setup-card error" role="alert">
        <span aria-hidden="true">⚠️</span>
        <h3>지도를 불러오지 못했어요</h3>
        <p>{errorMessage} JavaScript 키와 등록된 사이트 도메인을 확인해 주세요.</p>
      </div>
    )
  }

  return (
    <section className="map-panel" aria-label={`검색 결과 ${items.length}곳 지도`}>
      {status === 'loading' && <div className="map-loading">지도를 불러오는 중…</div>}
      <div className="kakao-map" ref={containerRef} />
      <p className="map-caption">마커를 누르면 장소 상세정보를 볼 수 있어요. 지도에는 현재 필터 결과 {items.length}곳이 표시됩니다.</p>
    </section>
  )
}


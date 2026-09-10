const SDK_ID = 'kakao-map-sdk'
let kakaoSdkPromise

export function loadKakaoSdk(appKey) {
  if (!appKey) return Promise.reject(new Error('카카오 지도 키가 설정되지 않았습니다.'))

  const finishLoading = (resolve, reject) => {
    if (!window.kakao?.maps) {
      reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'))
      return
    }
    window.kakao.maps.load(() => {
      if (!window.kakao?.maps?.services || !window.kakao?.maps?.MarkerClusterer) {
        reject(new Error('카카오 지도 검색 서비스를 불러오지 못했습니다. 페이지를 새로고침해 주세요.'))
        return
      }
      resolve(window.kakao.maps)
    })
  }

  if (window.kakao?.maps) {
    return new Promise(finishLoading)
  }

  if (kakaoSdkPromise) return kakaoSdkPromise

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(SDK_ID)
    const script = existingScript || document.createElement('script')

    const handleLoad = () => finishLoading(resolve, reject)

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', () => reject(new Error('카카오 지도 연결에 실패했습니다.')), { once: true })

    if (!existingScript) {
      script.id = SDK_ID
      script.async = true
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=clusterer,services`
      document.head.appendChild(script)
    }
  }).catch((error) => {
    kakaoSdkPromise = undefined
    throw error
  })

  return kakaoSdkPromise
}

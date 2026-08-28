function getDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return { userAgent: '', maxTouchPoints: 0 }
  }

  return {
    userAgent: navigator.userAgent || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
  }
}

export function isMobileDevice(deviceInfo = getDeviceInfo()) {
  const { userAgent = '', maxTouchPoints = 0 } = deviceInfo
  const mobileUserAgent = /Android|iPhone|iPad|iPod|IEMobile|Windows Phone|Mobile/i.test(userAgent)
  const iPadDesktopMode = /Macintosh/i.test(userAgent) && maxTouchPoints > 1

  return mobileUserAgent || iPadDesktopMode
}

export function hasValidCoordinates(place) {
  const latitude = Number(place?.latitude)
  const longitude = Number(place?.longitude)

  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
}

function getEncodedPlaceName(place) {
  return encodeURIComponent(String(place?.name || '').trim())
}

export function getKakaoSearchLink(place) {
  const encodedName = getEncodedPlaceName(place)
  return encodedName ? `https://map.kakao.com/link/search/${encodedName}` : 'https://map.kakao.com/'
}

export function getKakaoMapLink(place) {
  if (!hasValidCoordinates(place)) return getKakaoSearchLink(place)

  const encodedName = getEncodedPlaceName(place)
  return `https://map.kakao.com/link/map/${encodedName},${Number(place.latitude)},${Number(place.longitude)}`
}

export function getKakaoDirectionsLinks(place, deviceInfo) {
  const placeFallbackUrl = getKakaoMapLink(place)

  if (!hasValidCoordinates(place) || !String(place?.name || '').trim()) {
    return {
      primaryUrl: placeFallbackUrl,
      webFallbackUrl: placeFallbackUrl,
      placeFallbackUrl,
      mode: 'place',
    }
  }

  const latitude = Number(place.latitude)
  const longitude = Number(place.longitude)
  const encodedName = getEncodedPlaceName(place)
  const webFallbackUrl = `https://map.kakao.com/link/to/${encodedName},${latitude},${longitude}`

  if (!isMobileDevice(deviceInfo)) {
    return {
      primaryUrl: webFallbackUrl,
      webFallbackUrl,
      placeFallbackUrl,
      mode: 'web',
    }
  }

  return {
    primaryUrl: `https://m.map.kakao.com/scheme/route?ep=${latitude},${longitude}&by=car`,
    webFallbackUrl,
    placeFallbackUrl,
    mode: 'mobile',
  }
}

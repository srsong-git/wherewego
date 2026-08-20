export function calculateDistance(from, place) {
  const toRadians = (degrees) => degrees * (Math.PI / 180)
  const earthRadius = 6371
  const latitudeDelta = toRadians(place.latitude - from.latitude)
  const longitudeDelta = toRadians(place.longitude - from.longitude)
  const latitude1 = toRadians(from.latitude)
  const latitude2 = toRadians(place.latitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function searchPlaces(places, filters) {
  return places.filter((place) => {
    const weatherMatch = !filters.weather || filters.weather === 'outdoor' || place.indoorOutdoor === '실내'
    const ageMatch = !filters.age || place.ageGroups.includes(filters.age)
    const durationMatch = !filters.duration || place.duration === filters.duration
    const priceMatch = !filters.price
      || filters.price === '상관없음'
      || place.priceCategory === '무료'
      || (filters.price === '3만원 이하' && place.priceCategory === '3만원 이하')
    const themeMatch = !filters.themes.length || filters.themes.some((theme) => place.themes.includes(theme))

    return weatherMatch && ageMatch && durationMatch && priceMatch && themeMatch
  })
}

export function refinePlaces(results, filters, favoriteIds, location) {
  const refined = results.filter((place) => {
    const regionMatch = filters.region === '전체' || place.region === filters.region
    const themeMatch = !filters.themes.length || filters.themes.some((theme) => place.themes.includes(theme))
    const environmentMatch = filters.environment === '전체'
      || filters.environment === '실내+야외'
      || place.indoorOutdoor === filters.environment
    const favoriteMatch = !filters.favoritesOnly || favoriteIds.includes(place.id)

    return regionMatch && themeMatch && environmentMatch && favoriteMatch
  }).map((place, recommendationIndex) => ({
    place,
    recommendationIndex,
    distance: location ? calculateDistance(location, place) : null,
  }))

  if (filters.sort === 'distance' && location) {
    return refined.sort((a, b) => a.distance - b.distance)
  }

  if (filters.sort === 'name') {
    return refined.sort((a, b) => a.place.name.localeCompare(b.place.name, 'ko'))
  }

  return refined.sort((a, b) => a.recommendationIndex - b.recommendationIndex)
}

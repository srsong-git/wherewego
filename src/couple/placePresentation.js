const FIXTURE_DATASET_VERSION = 'couple-fixture-v1'
const FIXTURE_INTERNAL_SENTENCE_PATTERN = /(?:개발용|개발 전용).*fixture예요[.!?。！？]?$/u

export function getDisplayPlaceName(name) {
  if (typeof name !== 'string') return name
  return name.replace(/^\[Fixture\]\s+/, '')
}

export function getDisplayPlaceDescription(description, datasetVersion) {
  if (typeof description !== 'string') return description
  if (datasetVersion !== FIXTURE_DATASET_VERSION) return description

  const sentences = description.match(/[^.!?。！？]+[.!?。！？]?/gu) || []
  return sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !FIXTURE_INTERNAL_SENTENCE_PATTERN.test(sentence))
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function toDisplayPlace(place, { datasetVersion } = {}) {
  if (!place || typeof place !== 'object') return place
  return {
    ...place,
    name: getDisplayPlaceName(place.name),
    description: getDisplayPlaceDescription(place.description, datasetVersion),
  }
}

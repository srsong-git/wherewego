import { useEffect, useState } from 'react'
import { filterOptions, places, themeOptions } from './data/places.js'
import { calculateDistance, refinePlaces, searchPlaces } from './utils/placeFilters.js'

const initialFilters = { weather: '', age: '', duration: '', price: '', themes: [] }
const initialResultFilters = { region: '전체', themes: [], environment: '전체', sort: 'default', favoritesOnly: false }
const regionOptions = ['전체', '서울', '경기', '인천']
const environmentOptions = ['전체', '실내', '야외', '실내+야외']
const themeLabelMap = Object.fromEntries(themeOptions.map(({ value, label }) => [value, label]))

function formatDistance(distance) {
  return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function FilterGroup({ group, selected, onSelect }) {
  return (
    <fieldset className="filter-group">
      <legend><span aria-hidden="true">{group.icon}</span> {group.label}</legend>
      <div className="choice-list">
        {group.options.map((option) => (
          <button
            className={selected === option.value ? 'choice active' : 'choice'}
            type="button"
            aria-pressed={selected === option.value}
            onClick={() => onSelect(selected === option.value ? '' : option.value)}
            key={option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ThemeSelector({ selected, onToggle, compact = false }) {
  return (
    <div className={compact ? 'theme-list compact' : 'theme-list'}>
      {themeOptions.map((theme) => (
        <button
          className={selected.includes(theme.value) ? 'theme-choice active' : 'theme-choice'}
          type="button"
          aria-pressed={selected.includes(theme.value)}
          onClick={() => onToggle(theme.value)}
          key={theme.value}
        >
          {theme.label}
        </button>
      ))}
    </div>
  )
}

function PlaceCard({ place, distance, isFavorite, onToggleFavorite, onOpen }) {
  return (
    <article className="place-card">
      <div className="card-heading">
        <div>
          <p className="area">📍 {place.area}</p>
          <h3>{place.name}</h3>
        </div>
        <div className="card-actions">
          <button
            className={isFavorite ? 'favorite-button active' : 'favorite-button'}
            type="button"
            aria-label={`${place.name} ${isFavorite ? '찜 해제' : '찜하기'}`}
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite(place.id)}
          >
            {isFavorite ? '♥' : '♡'}
          </button>
          <span className={`type-badge ${place.indoorOutdoor === '실내' ? 'indoor' : 'outdoor'}`}>
            {place.indoorOutdoor === '실내' ? '☔' : '☀️'} {place.indoorOutdoor}
          </span>
        </div>
      </div>
      <div className="theme-badges">
        {place.themes.slice(0, 2).map((theme) => <span key={theme}>{themeLabelMap[theme]}</span>)}
      </div>
      <p className="description">{place.description}</p>
      <div className="meta-list">
        {distance != null && <span className="distance-badge">📏 직선거리 약 {formatDistance(distance)}</span>}
        <span>👧 {place.ageGroups.join(' · ')}</span>
        <span>⏱ {place.duration}</span>
        <span>💰 {place.priceCategory}</span>
      </div>
      <button className="detail-button" type="button" onClick={() => onOpen(place)}>자세히 보기 <span>→</span></button>
    </article>
  )
}

function RandomPick({ place, distance, onRetry, onClose, onOpen }) {
  return (
    <section className="random-pick" aria-live="polite">
      <button className="close-button" type="button" onClick={onClose} aria-label="랜덤 추천 닫기">×</button>
      <p className="eyebrow">오늘의 랜덤 추천</p>
      <h2>🎉 오늘은 <strong>{place.name}</strong> 어때요?</h2>
      <p className="pick-description">{place.description}</p>
      <div className="pick-meta">
        <span>📍 {place.area}</span>
        {distance != null && <span>📏 직선거리 약 {formatDistance(distance)}</span>}
        <span>{place.indoorOutdoor === '실내' ? '☔' : '☀️'} {place.indoorOutdoor}</span>
        <span>👧 {place.ageGroups.join(' · ')}</span>
        <span>⏱ {place.duration}</span>
      </div>
      <div className="pick-buttons">
        <button className="secondary-button" type="button" onClick={onRetry}>🎲 다시 골라줘</button>
        <button className="pick-detail-button" type="button" onClick={() => onOpen(place)}>상세정보 보기</button>
      </div>
    </section>
  )
}

function ResultFilters({ filters, setFilters, favoriteCount, location, onReset }) {
  const activeCount = (filters.region !== '전체' ? 1 : 0)
    + filters.themes.length
    + (filters.environment !== '전체' ? 1 : 0)
    + (filters.favoritesOnly ? 1 : 0)

  return (
    <section className="refine-panel" aria-labelledby="refine-title">
      <div className="refine-heading">
        <div>
          <p className="step">QUICK FILTER</p>
          <h3 id="refine-title">결과 내에서 더 좁혀보기</h3>
          <p>버튼을 누르면 결과에 바로 반영돼요.</p>
        </div>
        <div className="active-filter-count">적용 중 {activeCount}개</div>
      </div>

      <div className="refine-grid">
        <div className="refine-group">
          <strong>지역</strong>
          <div className="mini-choices">
            {regionOptions.map((region) => (
              <button className={filters.region === region ? 'active' : ''} type="button" aria-pressed={filters.region === region} onClick={() => setFilters({ ...filters, region })} key={region}>{region}</button>
            ))}
          </div>
        </div>
        <div className="refine-group">
          <strong>실내 / 야외</strong>
          <div className="mini-choices">
            {environmentOptions.map((environment) => (
              <button className={filters.environment === environment ? 'active' : ''} type="button" aria-pressed={filters.environment === environment} onClick={() => setFilters({ ...filters, environment })} key={environment}>{environment}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="refine-group refine-themes">
        <strong>테마</strong>
        <ThemeSelector compact selected={filters.themes} onToggle={(theme) => setFilters({ ...filters, themes: toggleValue(filters.themes, theme) })} />
      </div>

      <div className="refine-footer">
        <button className={filters.favoritesOnly ? 'favorites-only active' : 'favorites-only'} type="button" aria-pressed={filters.favoritesOnly} onClick={() => setFilters({ ...filters, favoritesOnly: !filters.favoritesOnly })}>❤️ 찜한 곳 {favoriteCount}</button>
        <label className="sort-control">정렬
          <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="default">기본 추천순</option>
            <option value="distance">📍 가까운 순</option>
            <option value="name">가나다순</option>
          </select>
        </label>
        <button className="refine-reset" type="button" onClick={onReset}>↻ 결과 내 필터 초기화</button>
      </div>
      {filters.sort === 'distance' && !location && <p className="sort-notice" role="status">가까운 순으로 보려면 내 위치를 먼저 확인해 주세요.</p>}
    </section>
  )
}

function PlaceModal({ place, distance, isFavorite, onToggleFavorite, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="place-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-top">
          <p className="eyebrow">PLACE DETAIL</p>
          <div>
            <button className={isFavorite ? 'modal-favorite active' : 'modal-favorite'} type="button" onClick={() => onToggleFavorite(place.id)}>{isFavorite ? '♥ 찜했어요' : '♡ 찜하기'}</button>
            <button className="modal-close" type="button" onClick={onClose} aria-label="상세정보 닫기">×</button>
          </div>
        </div>
        <h2 id="modal-title">{place.name}</h2>
        <p className="modal-description">{place.description}</p>
        <div className="modal-themes">{place.themes.map((theme) => <span key={theme}>{themeLabelMap[theme]}</span>)}</div>
        <dl className="detail-list">
          <div><dt>📍 지역</dt><dd>{place.area}</dd></div>
          {distance != null && <div><dt>📏 거리</dt><dd>현재 위치에서 직선거리 약 {formatDistance(distance)}</dd></div>}
          <div><dt>{place.indoorOutdoor === '실내' ? '☔' : '☀️'} 공간</dt><dd>{place.indoorOutdoor}</dd></div>
          <div><dt>👧 추천 연령</dt><dd>{place.ageGroups.join(' · ')}</dd></div>
          <div><dt>⏱ 예상 시간</dt><dd>{place.duration}</dd></div>
          <div><dt>💰 비용 구분</dt><dd>{place.priceCategory}</dd></div>
        </dl>
        <p className="modal-note">운영시간과 실제 요금은 방문 전에 해당 장소의 최신 안내를 확인해 주세요.</p>
      </section>
    </div>
  )
}

export default function App() {
  const [filters, setFilters] = useState(initialFilters)
  const [results, setResults] = useState(null)
  const [resultFilters, setResultFilters] = useState(initialResultFilters)
  const [randomPick, setRandomPick] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [location, setLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('oneul-favorite-places') || '[]')
      return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('oneul-favorite-places', JSON.stringify(favoriteIds))
  }, [favoriteIds])

  const getMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }

    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setLocationStatus('success')
      },
      () => setLocationStatus('error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    )
  }

  const displayedResults = results ? refinePlaces(results, resultFilters, favoriteIds, location) : []

  const findPlaces = () => {
    setResults(searchPlaces(places, filters))
    setResultFilters(initialResultFilters)
    setRandomPick(null)
  }

  const resetAll = () => {
    setFilters(initialFilters)
    setResults(null)
    setResultFilters(initialResultFilters)
    setRandomPick(null)
    setSelectedPlace(null)
  }

  const toggleFavorite = (id) => {
    setFavoriteIds((current) => current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id])
  }

  const chooseRandom = () => {
    if (!displayedResults.length) return
    const candidates = displayedResults.length > 1 && randomPick
      ? displayedResults.filter(({ place }) => place.id !== randomPick.id)
      : displayedResults
    setRandomPick(candidates[Math.floor(Math.random() * candidates.length)].place)
  }

  return (
    <>
      <header className="hero">
        <nav className="nav" aria-label="주요 메뉴">
          <a className="brand" href="#top" aria-label="오늘 어디가지 홈">오늘 어디가지? <span>👟</span></a>
          <span className="nav-note">서울·수도권 가족 나들이</span>
        </nav>
        <div className="hero-content" id="top">
          <p className="eyebrow">오늘의 나들이, 가볍게 골라요</p>
          <h1>아이와 갈 곳 고민은<br /><em>10초면 충분해요.</em></h1>
          <p className="subtitle">조건을 골라 오늘 갈 곳을 찾아보세요.</p>
          <div className="hero-tags" aria-label="서비스 특징">
            <span>✓ 간단한 조건 선택</span><span>✓ {places.length}곳 추천</span><span>✓ 랜덤 뽑기</span>
          </div>
        </div>
      </header>

      <main>
        <section className="finder-panel" aria-labelledby="finder-title">
          <div className="section-title">
            <div><p className="step">STEP 01</p><h2 id="finder-title">어떤 나들이를 원하세요?</h2></div>
            <button className="reset-button" type="button" onClick={resetAll}>↻ 초기화</button>
          </div>
          <p className="helper">선택하지 않은 항목은 전체로 찾아드려요. 테마는 여러 개 고를 수 있어요.</p>
          <div className="location-row">
            <div>
              <strong>📍 내 위치에서 얼마나 가까울까요?</strong>
              <p>위치를 허용하면 가까운 순으로 정렬할 수 있어요.</p>
            </div>
            <button className={location ? 'location-button active' : 'location-button'} type="button" onClick={getMyLocation} disabled={locationStatus === 'loading'}>
              {locationStatus === 'loading' ? '위치 확인 중…' : location ? '✓ 내 위치 확인됨' : '내 위치로 거리 보기'}
            </button>
          </div>
          {(locationStatus === 'error' || locationStatus === 'unsupported') && <p className="location-error" role="alert">위치를 확인하지 못했어요. 브라우저의 위치 권한을 확인해 주세요.</p>}
          <div className="filters">
            {filterOptions.map((group) => <FilterGroup key={group.key} group={group} selected={filters[group.key]} onSelect={(value) => setFilters({ ...filters, [group.key]: value })} />)}
          </div>
          <fieldset className="theme-filter">
            <legend>🎯 테마 <span>여러 개 선택 가능</span></legend>
            <ThemeSelector selected={filters.themes} onToggle={(theme) => setFilters({ ...filters, themes: toggleValue(filters.themes, theme) })} />
          </fieldset>
          <button className="primary-button" type="button" onClick={findPlaces}>갈 곳 찾아보기 <span aria-hidden="true">→</span></button>
        </section>

        {results && (
          <section className="results" id="results" aria-labelledby="results-title">
            <div className="results-heading">
              <div>
                <p className="step">STEP 02</p>
                <h2 id="results-title">{displayedResults.length ? <>현재 조건에 맞는 장소 <em>{displayedResults.length}곳</em>이에요!</> : '조건에 맞는 장소가 없어요 😢'}</h2>
                <p className="result-summary">처음 검색 결과 {results.length}곳 · 현재 표시 {displayedResults.length}곳</p>
              </div>
              {displayedResults.length > 0 && <button className="random-button" type="button" onClick={chooseRandom}>🎲 아무 데나 골라줘</button>}
            </div>

            <ResultFilters filters={resultFilters} setFilters={setResultFilters} favoriteCount={favoriteIds.length} location={location} onReset={() => setResultFilters(initialResultFilters)} />

            {randomPick && displayedResults.some(({ place }) => place.id === randomPick.id) && (
              <RandomPick place={randomPick} distance={location ? calculateDistance(location, randomPick) : null} onRetry={chooseRandom} onClose={() => setRandomPick(null)} onOpen={setSelectedPlace} />
            )}

            {displayedResults.length ? (
              <div className="card-grid">{displayedResults.map(({ place, distance }) => (
                <PlaceCard place={place} distance={distance} isFavorite={favoriteIds.includes(place.id)} onToggleFavorite={toggleFavorite} onOpen={setSelectedPlace} key={place.id} />
              ))}</div>
            ) : (
              <div className="empty-state">
                <span>🧐</span>
                <p>지역이나 테마 조건을 하나 줄여보세요.</p>
                <button className="empty-reset" type="button" onClick={() => setResultFilters(initialResultFilters)}>결과 내 필터 초기화</button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer><strong>오늘 어디가지? 👟</strong><span>가족의 즐거운 오늘을 응원해요.</span></footer>

      {selectedPlace && (
        <PlaceModal place={selectedPlace} distance={location ? calculateDistance(location, selectedPlace) : null} isFavorite={favoriteIds.includes(selectedPlace.id)} onToggleFavorite={toggleFavorite} onClose={() => setSelectedPlace(null)} />
      )}
    </>
  )
}

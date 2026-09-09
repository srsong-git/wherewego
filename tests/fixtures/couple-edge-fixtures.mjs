import { getFixturePlaces } from '../../supabase/functions/_shared/couple-fixtures.mjs'

const base = getFixturePlaces('seongsu')[0]

// Production finalization never imports this file. These records exist only for
// expiry/inactive/no-match test cases and stay outside the active fixture pool.
export const inactiveFixturePlace = {
  ...base,
  id: 'fixture-test-inactive',
  name: '[Fixture Test] 비활성 장소',
  status: 'inactive',
}

export const expiredFixturePlace = {
  ...base,
  id: 'fixture-test-expired',
  name: '[Fixture Test] 만료 장소',
  validUntil: '2026-08-01T00:00:00Z',
}

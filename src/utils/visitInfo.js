export const VISIT_INFO_STALE_DAYS = 90

export function isVisitInfoStale(verifiedAt, now = new Date()) {
  const verifiedTime = Date.parse(`${verifiedAt}T00:00:00Z`)
  const nowTime = now instanceof Date ? now.getTime() : Number(now)
  if (!Number.isFinite(verifiedTime) || !Number.isFinite(nowTime)) return true
  return nowTime - verifiedTime > VISIT_INFO_STALE_DAYS * 24 * 60 * 60 * 1000
}

export function formatVerifiedAt(verifiedAt) {
  const [year, month, day] = String(verifiedAt).split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return verifiedAt
  return `${year}년 ${month}월 ${day}일 확인`
}

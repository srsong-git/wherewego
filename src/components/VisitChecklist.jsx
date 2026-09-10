import { formatVerifiedAt, isVisitInfoStale } from '../utils/visitInfo.js'

const reservationLabels = {
  required: '예약이 필요해요',
  recommended: '미리 예약하면 좋아요',
  not_required: '예약 없이 이용 가능해요',
  partial: '일부 프로그램은 예약이 필요해요',
  unknown: '공식 안내에서 확인해 주세요',
}

export default function VisitChecklist({ visitInfo }) {
  if (!visitInfo) return null
  const stale = isVisitInfoStale(visitInfo.verifiedAt)
  const rows = [
    ['🎟️', '예약', reservationLabels[visitInfo.reservationStatus] || reservationLabels.unknown, visitInfo.reservationNote],
    ['🕒', '운영', visitInfo.operationNote, null],
    ['🧒', '연령·입장', visitInfo.ageRestrictionNote, null],
    ['🚗', '주차', visitInfo.parkingNote, null],
  ].filter(([, , value]) => value)

  return (
    <section className="visit-checklist" aria-labelledby="visit-checklist-title">
      <div className="visit-checklist-heading">
        <div>
          <p>BEFORE YOU GO</p>
          <h3 id="visit-checklist-title">방문 전 체크</h3>
        </div>
        <span className={stale ? 'visit-verified stale' : 'visit-verified'}>{formatVerifiedAt(visitInfo.verifiedAt)}</span>
      </div>
      {stale && <p className="visit-stale-warning" role="status">최근 확인일이 오래되었어요. 방문 전 공식 정보를 다시 확인해 주세요.</p>}
      <dl className="visit-checklist-list">
        {rows.map(([icon, label, value, note]) => (
          <div key={label}>
            <dt>{icon} {label}</dt>
            <dd><strong>{value}</strong>{note && <small>{note}</small>}</dd>
          </div>
        ))}
      </dl>
      {visitInfo.importantNotes?.length > 0 && (
        <ul className="visit-important-notes">
          {visitInfo.importantNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      <div className="visit-checklist-actions">
        {visitInfo.reservationUrl && visitInfo.reservationStatus !== 'unknown' && (
          <a className="reservation" href={visitInfo.reservationUrl} target="_blank" rel="noreferrer">예약 안내 확인 ↗</a>
        )}
        <a href={visitInfo.officialInfoUrl} target="_blank" rel="noreferrer">{visitInfo.officialSourceName} 공식 정보 ↗</a>
      </div>
      <p className="visit-checklist-disclaimer">운영·예약 조건은 바뀔 수 있어요. 이 정보는 실시간 안내가 아니므로 출발 전 공식 정보를 확인해 주세요.</p>
    </section>
  )
}

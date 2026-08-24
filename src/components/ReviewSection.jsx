import { useCallback, useEffect, useMemo, useState } from 'react'
import { getUserDisplayName, isSupabaseConfigured, supabase } from '../lib/supabase.js'

const reactionOptions = [
  { value: 5, emoji: '🤩', label: '최고예요' },
  { value: 4, emoji: '😄', label: '좋아했어요' },
  { value: 3, emoji: '🙂', label: '괜찮았어요' },
  { value: 2, emoji: '😐', label: '보통이에요' },
  { value: 1, emoji: '😕', label: '아쉬워요' },
]

const revisitOptions = [
  { value: 3, emoji: '💚', label: '꼭 다시 갈래요' },
  { value: 2, emoji: '🙂', label: '기회가 되면' },
  { value: 1, emoji: '🤔', label: '잘 모르겠어요' },
]

const parkingOptions = [
  { value: 'easy', emoji: '🚗', label: '주차 쉬웠어요' },
  { value: 'normal', emoji: '🅿️', label: '보통이에요' },
  { value: 'hard', emoji: '😵', label: '힘들었어요' },
]

const crowdOptions = [
  { value: 'quiet', emoji: '🌿', label: '한산했어요' },
  { value: 'normal', emoji: '🙂', label: '보통이에요' },
  { value: 'crowded', emoji: '👥', label: '너무 붐볐어요' },
]

const parentFatigueOptions = [
  { value: 'low', emoji: '😊', label: '부모 피로도 낮음' },
  { value: 'normal', emoji: '🙂', label: '보통' },
  { value: 'high', emoji: '🥵', label: '높음' },
]

const hardPointOptions = ['많이 걸어요', '대기 길어요', '주차 어려워요', '음식 비싸요', '초고학년은 심심해요', '저학년은 힘들어해요', '특별히 없어요']

const reportReasons = ['개인정보 노출', '광고 또는 도배', '욕설 또는 부적절한 내용', '사실과 다른 정보', '기타']
const ageOptions = ['유아', '초등 저학년', '초등 고학년']
const emptyForm = {
  childReaction: null,
  revisitIntent: null,
  childAgeGroup: '',
  parkingDifficulty: '',
  crowdLevel: '',
  parentFatigueReview: '',
  hardPoints: [],
  content: '',
}
const emptyReport = { reason: reportReasons[0], details: '' }

function formatReviewDate(date) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date))
}

function optionLabel(options, value) {
  const option = options.find((item) => item.value === value)
  return option ? `${option.emoji} ${option.label}` : ''
}

function RatingChoices({ legend, options, value, onChange }) {
  return (
    <fieldset className="review-rating-group">
      <legend>{legend}</legend>
      <div className="review-rating-choices">
        {options.map((option) => (
          <button
            className={value === option.value ? 'active' : ''}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            key={option.value}
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function HardPointChoices({ values, onChange }) {
  const togglePoint = (point) => {
    if (point === '특별히 없어요') {
      onChange(values.includes(point) ? [] : [point])
      return
    }

    const current = values.filter((value) => value !== '특별히 없어요')
    onChange(current.includes(point) ? current.filter((value) => value !== point) : [...current, point])
  }

  return (
    <fieldset className="review-rating-group review-hard-points">
      <legend>힘들었던 점 <span>여러 개 선택 가능</span></legend>
      <div className="review-hard-point-choices">
        {hardPointOptions.map((point) => (
          <button className={values.includes(point) ? 'active' : ''} type="button" aria-pressed={values.includes(point)} onClick={() => togglePoint(point)} key={point}>
            {values.includes(point) ? '✓ ' : ''}{point}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function ReviewSection({ place, user, onLogin }) {
  const [reviews, setReviews] = useState([])
  const [myReview, setMyReview] = useState(null)
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading' : 'not-configured')
  const [form, setForm] = useState(emptyForm)
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [notice, setNotice] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [reportingReviewId, setReportingReviewId] = useState(null)
  const [reportForm, setReportForm] = useState(emptyReport)
  const [reportStatus, setReportStatus] = useState('idle')
  const [reportNotice, setReportNotice] = useState('')

  const loadPublicReviews = useCallback(async () => {
    if (!supabase) return
    setStatus('loading')
    const { data, error } = await supabase.rpc('get_public_reviews_v2', { target_place_id: place.id })

    if (error) {
      console.error('후기 조회 실패', error)
      setStatus('error')
      return
    }

    setReviews(data || [])
    setStatus('ready')
  }, [place.id])

  const loadMyReview = useCallback(async () => {
    if (!supabase || !user) {
      setMyReview(null)
      return
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id, place_id, user_id, author_name, child_reaction, revisit_intent, child_age_group, parking_difficulty, crowd_level, parent_fatigue_review, hard_points, content, created_at, updated_at')
      .eq('place_id', place.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('내 후기 조회 실패', error)
      return
    }
    setMyReview(data || null)
  }, [place.id, user])

  useEffect(() => {
    loadPublicReviews()
  }, [loadPublicReviews])

  useEffect(() => {
    loadMyReview()
  }, [loadMyReview])

  useEffect(() => {
    if (myReview) {
      setForm({
        childReaction: myReview.child_reaction,
        revisitIntent: myReview.revisit_intent,
        childAgeGroup: myReview.child_age_group,
        parkingDifficulty: myReview.parking_difficulty || '',
        crowdLevel: myReview.crowd_level || '',
        parentFatigueReview: myReview.parent_fatigue_review || '',
        hardPoints: myReview.hard_points || [],
        content: myReview.content,
      })
    } else {
      setForm(emptyForm)
    }
  }, [myReview, place.id, user?.id])

  useEffect(() => {
    setNotice('')
    setDeleteConfirmOpen(false)
    setReportingReviewId(null)
    setReportNotice('')
  }, [place.id, user?.id])

  const summary = useMemo(() => {
    if (!reviews.length) return null
    const reactionAverage = reviews.reduce((sum, review) => sum + review.child_reaction, 0) / reviews.length
    const positiveRevisits = reviews.filter((review) => review.revisit_intent >= 2).length
    return {
      reactionAverage: reactionAverage.toFixed(1),
      revisitRate: Math.round((positiveRevisits / reviews.length) * 100),
    }
  }, [reviews])

  const refreshReviews = async () => {
    await Promise.all([loadPublicReviews(), loadMyReview()])
  }

  const requiredSelectionsComplete = Boolean(
    form.childReaction
    && form.revisitIntent
    && form.childAgeGroup
    && form.parkingDifficulty
    && form.crowdLevel
    && form.parentFatigueReview,
  )
  const reviewFormComplete = requiredSelectionsComplete && form.content.trim().length >= 10

  const submitReview = async (event) => {
    event.preventDefault()
    if (!supabase || !user) return

    const content = form.content.trim()
    if (!requiredSelectionsComplete) {
      setNotice('아이 반응부터 방문 연령까지 필수 항목을 모두 선택해 주세요.')
      return
    }
    if (content.length < 10) {
      setNotice('후기는 10자 이상 작성해 주세요.')
      return
    }

    setSubmitStatus('saving')
    setNotice('')
    const payload = {
      place_id: place.id,
      user_id: user.id,
      author_name: getUserDisplayName(user).slice(0, 30),
      child_reaction: form.childReaction,
      revisit_intent: form.revisitIntent,
      child_age_group: form.childAgeGroup,
      parking_difficulty: form.parkingDifficulty,
      crowd_level: form.crowdLevel,
      parent_fatigue_review: form.parentFatigueReview,
      hard_points: form.hardPoints,
      content,
    }

    const { error } = await supabase.from('reviews').upsert(payload, { onConflict: 'place_id,user_id' })
    if (error) {
      console.error('후기 저장 실패', error)
      setNotice(error.message?.includes('20초') ? '도배 방지를 위해 20초 후에 다시 저장해 주세요.' : '후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSubmitStatus('idle')
      return
    }

    setNotice(myReview ? '후기를 수정했어요.' : '후기를 등록했어요.')
    setSubmitStatus('idle')
    await refreshReviews()
  }

  const deleteMyReview = async () => {
    if (!supabase || !myReview || !user) return
    setSubmitStatus('saving')
    setNotice('')
    const { data, error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', myReview.id)
      .eq('user_id', user.id)
      .select('id')

    if (error || !data?.length) {
      if (error) console.error('후기 삭제 실패', error)
      setNotice('후기를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSubmitStatus('idle')
      return
    }
    setForm(emptyForm)
    setMyReview(null)
    setDeleteConfirmOpen(false)
    setNotice('후기를 삭제했어요.')
    setSubmitStatus('idle')
    await refreshReviews()
  }

  const openReport = (reviewId) => {
    if (!user) {
      onLogin()
      return
    }
    setReportingReviewId(reviewId)
    setReportForm(emptyReport)
    setReportNotice('')
    setReportStatus('idle')
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (!supabase || !user || !reportingReviewId) return

    setReportStatus('saving')
    setReportNotice('')
    const { error } = await supabase.from('review_reports').insert({
      review_id: reportingReviewId,
      reporter_id: user.id,
      reason: reportForm.reason,
      details: reportForm.details.trim(),
    })

    if (error) {
      console.error('후기 신고 실패', error)
      setReportNotice(error.code === '23505' ? '이미 신고한 후기예요.' : '신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setReportStatus('idle')
      return
    }

    setReportNotice('신고가 접수됐어요. 운영자가 확인할게요.')
    setReportStatus('done')
  }

  return (
    <section className="review-section" aria-labelledby="review-title">
      <div className="review-heading">
        <div>
          <p className="step">FAMILY REVIEW</p>
          <h3 id="review-title">다녀온 가족들의 후기</h3>
        </div>
        <span className="review-count">후기 {reviews.length}개</span>
      </div>

      {summary ? (
        <div className="review-summary">
          <div><span>아이 반응</span><strong>🤩 {summary.reactionAverage}<small>/ 5</small></strong></div>
          <div><span>재방문 의사</span><strong>💚 {summary.revisitRate}%</strong></div>
        </div>
      ) : (
        <p className="review-empty-summary"><strong>아직 다녀온 가족 후기가 없어요.</strong><span>아이 반응을 남겨주시면 다음 가족에게 큰 도움이 돼요.</span></p>
      )}

      <p className="review-public-guide">허위 후기와 광고성 후기를 줄이기 위해 카카오 로그인 후 작성할 수 있어요. 닉네임, 아이 연령대, 평가와 후기 내용은 공개됩니다. 실명, 학교명, 연락처는 적지 마세요.</p>

      {!isSupabaseConfigured ? (
        <div className="review-login-card" role="status">
          <strong>후기 기능 연결을 준비하고 있어요.</strong>
          <p>데이터베이스 설정이 완료되면 카카오 로그인으로 후기를 남길 수 있어요.</p>
        </div>
      ) : !user ? (
        <div className="review-login-card">
          <strong>후기는 카카오 로그인 후 작성할 수 있어요.</strong>
          <p>작성자의 카카오 닉네임과 후기 내용은 공개됩니다. 개인정보는 적지 말아 주세요.</p>
          <button className="kakao-login-button" type="button" onClick={onLogin}>카카오로 로그인</button>
        </div>
      ) : (
        <form className="review-form" onSubmit={submitReview}>
          <div className="review-form-heading">
            <div><strong>{myReview ? '내 후기 수정' : '내 후기 작성'}</strong><span>{getUserDisplayName(user)}님</span></div>
            {myReview && !deleteConfirmOpen && <button className="review-delete" type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={submitStatus === 'saving'}>후기 삭제</button>}
          </div>

          {myReview && deleteConfirmOpen && (
            <div className="review-delete-confirm" role="alert">
              <div>
                <strong>이 후기를 정말 삭제할까요?</strong>
                <p>삭제한 후기는 다시 되돌릴 수 없어요.</p>
              </div>
              <div className="review-delete-actions">
                <button type="button" onClick={() => setDeleteConfirmOpen(false)} disabled={submitStatus === 'saving'}>취소</button>
                <button className="confirm" type="button" onClick={deleteMyReview} disabled={submitStatus === 'saving'}>{submitStatus === 'saving' ? '삭제 중…' : '삭제 확인'}</button>
              </div>
            </div>
          )}

          <RatingChoices legend="우리 아이 반응" options={reactionOptions} value={form.childReaction} onChange={(childReaction) => setForm({ ...form, childReaction })} />
          <RatingChoices legend="재방문 의사" options={revisitOptions} value={form.revisitIntent} onChange={(revisitIntent) => setForm({ ...form, revisitIntent })} />
          <div className="review-context-grid">
            <RatingChoices legend="주차는 어땠나요?" options={parkingOptions} value={form.parkingDifficulty} onChange={(parkingDifficulty) => setForm({ ...form, parkingDifficulty })} />
            <RatingChoices legend="사람은 얼마나 많았나요?" options={crowdOptions} value={form.crowdLevel} onChange={(crowdLevel) => setForm({ ...form, crowdLevel })} />
          </div>
          <RatingChoices legend="부모 피로도는 어땠나요?" options={parentFatigueOptions} value={form.parentFatigueReview} onChange={(parentFatigueReview) => setForm({ ...form, parentFatigueReview })} />
          <HardPointChoices values={form.hardPoints} onChange={(hardPoints) => setForm({ ...form, hardPoints })} />

          <label className="review-age-label">방문 당시 아이 연령
            <select value={form.childAgeGroup} onChange={(event) => setForm({ ...form, childAgeGroup: event.target.value })}>
              <option value="">선택해주세요</option>
              {ageOptions.map((age) => <option value={age} key={age}>{age}</option>)}
            </select>
          </label>

          <label className="review-content-label">후기
            <textarea
              value={form.content}
              maxLength="500"
              placeholder="아이와 어떤 점이 좋았는지 알려주세요. (10자 이상)"
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
            <span>{form.content.length} / 500</span>
          </label>
          <p className="review-privacy-note">닉네임, 아이 연령대, 평가와 후기 내용은 공개돼요. 실명, 학교명, 연락처는 적지 마세요.</p>
          {!reviewFormComplete && <p className="review-required-guide" id="review-required-guide">필수 평가 6개를 선택하고 후기를 10자 이상 작성하면 등록할 수 있어요.</p>}

          {notice && <p className="review-notice" role="status">{notice}</p>}
          <button className="review-submit" type="submit" aria-describedby={!reviewFormComplete ? 'review-required-guide' : undefined} disabled={submitStatus === 'saving' || !reviewFormComplete}>{submitStatus === 'saving' ? '저장 중…' : myReview ? '후기 수정하기' : '후기 등록하기'}</button>
        </form>
      )}

      <div className="review-list" aria-live="polite">
        {status === 'loading' && <p className="review-state">후기를 불러오는 중…</p>}
        {status === 'error' && <p className="review-state error">후기를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>}
        {status === 'ready' && reviews.length === 0 && <p className="review-state">첫 가족 후기를 기다리고 있어요.</p>}
        {status === 'ready' && reviews.map((review) => {
          const isMine = myReview?.id === review.id
          return (
            <article className={isMine ? 'review-item mine' : 'review-item'} key={review.id}>
              <div className="review-item-heading">
                <div><strong>{review.author_name}</strong>{isMine && <span>내 후기</span>}</div>
                <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>
              </div>
              <div className="review-badges">
                <span>아이 반응 {optionLabel(reactionOptions, review.child_reaction)}</span>
                <span>재방문 {optionLabel(revisitOptions, review.revisit_intent)}</span>
                <span>👧 {review.child_age_group}</span>
                {review.parking_difficulty && <span>{optionLabel(parkingOptions, review.parking_difficulty)}</span>}
                {review.crowd_level && <span>혼잡도 {optionLabel(crowdOptions, review.crowd_level)}</span>}
                {review.parent_fatigue_review && <span>{optionLabel(parentFatigueOptions, review.parent_fatigue_review)}</span>}
                {(review.hard_points || []).map((point) => <span className="hard-point" key={point}>⚠️ {point}</span>)}
              </div>
              <p>{review.content}</p>
              {!isMine && <button className="review-report-button" type="button" onClick={() => openReport(review.id)}>신고</button>}
              {reportingReviewId === review.id && (
                <form className="review-report-form" onSubmit={submitReport}>
                  <strong>후기 신고</strong>
                  <label>신고 이유
                    <select value={reportForm.reason} onChange={(event) => setReportForm({ ...reportForm, reason: event.target.value })}>
                      {reportReasons.map((reason) => <option value={reason} key={reason}>{reason}</option>)}
                    </select>
                  </label>
                  <label>추가 설명 <span>(선택)</span>
                    <textarea value={reportForm.details} maxLength="300" onChange={(event) => setReportForm({ ...reportForm, details: event.target.value })} />
                  </label>
                  {reportNotice && <p role="status">{reportNotice}</p>}
                  <div>
                    <button type="button" onClick={() => setReportingReviewId(null)}>닫기</button>
                    {reportStatus !== 'done' && <button className="submit" type="submit" disabled={reportStatus === 'saving'}>{reportStatus === 'saving' ? '접수 중…' : '신고 접수'}</button>}
                  </div>
                </form>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

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

const ageOptions = ['유아', '초등 저학년', '초등 고학년']
const emptyForm = { childReaction: 5, revisitIntent: 3, childAgeGroup: '유아', content: '' }

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

export default function ReviewSection({ place, user, onLogin }) {
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading' : 'not-configured')
  const [form, setForm] = useState(emptyForm)
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [notice, setNotice] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const loadReviews = useCallback(async () => {
    if (!supabase) return
    setStatus('loading')
    const { data, error } = await supabase
      .from('reviews')
      .select('id, place_id, user_id, author_name, child_reaction, revisit_intent, child_age_group, content, created_at, updated_at')
      .eq('place_id', place.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('후기 조회 실패', error)
      setStatus('error')
      return
    }

    setReviews(data || [])
    setStatus('ready')
  }, [place.id])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  const myReview = useMemo(
    () => user ? reviews.find((review) => review.user_id === user.id) : null,
    [reviews, user],
  )

  useEffect(() => {
    if (myReview) {
      setForm({
        childReaction: myReview.child_reaction,
        revisitIntent: myReview.revisit_intent,
        childAgeGroup: myReview.child_age_group,
        content: myReview.content,
      })
    } else {
      setForm(emptyForm)
    }
  }, [myReview, place.id, user?.id])

  useEffect(() => {
    setNotice('')
    setDeleteConfirmOpen(false)
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

  const submitReview = async (event) => {
    event.preventDefault()
    if (!supabase || !user) return

    const content = form.content.trim()
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
      content,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('reviews').upsert(payload, { onConflict: 'place_id,user_id' })
    if (error) {
      console.error('후기 저장 실패', error)
      setNotice('후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSubmitStatus('idle')
      return
    }

    setNotice(myReview ? '후기를 수정했어요.' : '후기를 등록했어요.')
    setSubmitStatus('idle')
    await loadReviews()
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
    setDeleteConfirmOpen(false)
    setNotice('후기를 삭제했어요.')
    setSubmitStatus('idle')
    await loadReviews()
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
        <p className="review-empty-summary">아직 후기가 없어요. 첫 가족 후기를 남겨주세요!</p>
      )}

      {!isSupabaseConfigured ? (
        <div className="review-login-card" role="status">
          <strong>후기 기능 연결을 준비하고 있어요.</strong>
          <p>데이터베이스 설정이 완료되면 카카오 로그인으로 후기를 남길 수 있어요.</p>
        </div>
      ) : !user ? (
        <div className="review-login-card">
          <strong>후기는 카카오 로그인 후 작성할 수 있어요.</strong>
          <p>로그인하면 장소별로 내 후기를 작성하고 언제든 수정할 수 있어요.</p>
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

          <label className="review-age-label">방문 당시 아이 연령
            <select value={form.childAgeGroup} onChange={(event) => setForm({ ...form, childAgeGroup: event.target.value })}>
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

          {notice && <p className="review-notice" role="status">{notice}</p>}
          <button className="review-submit" type="submit" disabled={submitStatus === 'saving'}>{submitStatus === 'saving' ? '저장 중…' : myReview ? '후기 수정하기' : '후기 등록하기'}</button>
        </form>
      )}

      <div className="review-list" aria-live="polite">
        {status === 'loading' && <p className="review-state">후기를 불러오는 중…</p>}
        {status === 'error' && <p className="review-state error">후기를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>}
        {status === 'ready' && reviews.length === 0 && <p className="review-state">등록된 후기가 아직 없어요.</p>}
        {status === 'ready' && reviews.map((review) => (
          <article className={review.user_id === user?.id ? 'review-item mine' : 'review-item'} key={review.id}>
            <div className="review-item-heading">
              <div><strong>{review.author_name}</strong>{review.user_id === user?.id && <span>내 후기</span>}</div>
              <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>
            </div>
            <div className="review-badges">
              <span>아이 반응 {optionLabel(reactionOptions, review.child_reaction)}</span>
              <span>재방문 {optionLabel(revisitOptions, review.revisit_intent)}</span>
              <span>👧 {review.child_age_group}</span>
            </div>
            <p>{review.content}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

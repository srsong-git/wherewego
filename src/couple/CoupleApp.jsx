import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  coupleBackendReady,
  createDecisionSession,
  ensureCoupleAuth,
  finalizeDecisionSession,
  getDecisionSessionState,
  joinDecisionSession,
  resumeDecisionSession,
  submitPreferenceResponse,
  subscribeToDecisionSession,
} from './api.js'
import { meetingAreaMap, meetingAreas, preferenceQuestions, vetoOptions } from './config.js'
import { buildInviteShare, buildInviteUrl, copyText, sharePayload, shouldOfferMobileShare } from './share.js'

const CoupleResult = lazy(() => import('./CoupleResult.jsx'))

const ROOM_PATTERN = /^\/couple\/r\/([a-f0-9]{16})\/?$/
const SESSION_KEY_PREFIX = 'oneul-couple-session:'
const INVITE_KEY_PREFIX = 'oneul-couple-invite:'
const DRAFT_KEY_PREFIX = 'oneul-couple-draft:'

function errorMessage(error) {
  const messages = {
    ROOM_NOT_FOUND: '존재하지 않는 방이에요.',
    ROOM_EXPIRED: '이 방은 72시간이 지나 만료됐어요.',
    ROOM_FULL: '이미 두 명이 참여한 방이에요.',
    INVALID_INVITE: '초대 링크가 올바르지 않거나 이미 사용됐어요.',
    NOT_A_PARTICIPANT: '이 브라우저에서는 방에 참여한 기록을 찾지 못했어요.',
    INVALID_ANSWERS: '응답을 확인하지 못했어요. 다시 선택해 주세요.',
    AUTH_REQUIRED: '익명 참여를 시작하지 못했어요.',
    CATALOG_UNAVAILABLE: '추천 장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  }
  return messages[error?.code] || error?.message || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

function readMobileShareAvailability() {
  const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const isMobile = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px)').matches
  return shouldOfferMobileShare({ hasShare, isMobile })
}

function useMobileShareAvailability() {
  const [available, setAvailable] = useState(readMobileShareAvailability)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateAvailability = () => setAvailable(readMobileShareAvailability())
    updateAvailability()
    mediaQuery.addEventListener?.('change', updateAvailability)
    return () => mediaQuery.removeEventListener?.('change', updateAvailability)
  }, [])

  return available
}

function CoupleHeader({ compact = false }) {
  return (
    <header className={compact ? 'couple-nav compact' : 'couple-nav'}>
      <a className="couple-brand" href="/couple" aria-label="오늘 어디가지 둘이 고르기 홈">
        오늘 어디가지? <span aria-hidden="true">👟</span>
      </a>
      <a className="family-link" href="/">가족 나들이 찾기</a>
    </header>
  )
}

function CoupleLanding() {
  const [meetingArea, setMeetingArea] = useState('')
  const [status, setStatus] = useState('idle')
  const [notice, setNotice] = useState('')

  const handleCreate = async () => {
    if (!meetingArea || status === 'saving') return
    setStatus('saving')
    setNotice('')
    try {
      await ensureCoupleAuth()
      const room = await createDecisionSession(meetingArea)
      localStorage.setItem(`${SESSION_KEY_PREFIX}${room.public_code}`, room.session_id)
      localStorage.setItem(`${INVITE_KEY_PREFIX}${room.public_code}`, room.invite_secret)
      window.location.assign(`/couple/r/${room.public_code}`)
    } catch (error) {
      setStatus('idle')
      setNotice(errorMessage(error))
    }
  }

  return (
    <div className="couple-page landing-page">
      <section className="couple-hero">
        <CoupleHeader />
        <div className="couple-hero-content">
          <p className="couple-eyebrow">오늘 우리 둘 어디가지?</p>
          <h1>각자 고르면,<br /><em>우리가 맞춰드려요.</em></h1>
          <p>상대의 답을 보지 않고 5가지만 고르면<br />둘 다 받아들일 만한 오늘의 장소를 골라드려요.</p>
          <div className="couple-feature-pills" aria-label="둘이 고르기 특징">
            <span>✓ 회원가입 없이</span>
            <span>✓ 서로의 답은 비공개</span>
            <span>✓ 강력추천 하나부터</span>
          </div>
        </div>
      </section>

      <main className="couple-landing-main">
        <section className="meeting-panel" aria-labelledby="meeting-area-title">
          <div className="couple-section-heading">
            <p>STEP 01</p>
            <h2 id="meeting-area-title">어디에서 만날까요?</h2>
            <span>정확한 위치 대신 대략적인 권역만 사용해요.</span>
          </div>
          <div className="meeting-area-grid">
            {meetingAreas.map((area) => (
              <button
                type="button"
                className={meetingArea === area.value ? 'meeting-area-card active' : 'meeting-area-card'}
                aria-pressed={meetingArea === area.value}
                onClick={() => setMeetingArea(area.value)}
                key={area.value}
              >
                <strong>{area.title}</strong>
                <span>{area.description}</span>
                <small>{meetingArea === area.value ? '✓ 선택했어요' : '이 권역에서 고르기'}</small>
              </button>
            ))}
          </div>
          {!coupleBackendReady && (
            <p className="couple-alert" role="alert">Supabase 환경변수를 연결하면 방 만들기를 시작할 수 있어요.</p>
          )}
          {notice && <p className="couple-alert" role="alert">{notice}</p>}
          <button
            className="couple-primary wide"
            type="button"
            disabled={!meetingArea || !coupleBackendReady || status === 'saving'}
            onClick={handleCreate}
          >
            {status === 'saving' ? '둘만의 방 만드는 중…' : '둘이 고르기 시작'} <span aria-hidden="true">→</span>
          </button>
          <p className="fixture-notice">장소 운영 정보는 바뀔 수 있으니 방문 전 최신 정보를 확인해 주세요.</p>
        </section>
      </main>
      <footer className="couple-footer"><span>오늘 어디가지? 👟</span><a href="/">기존 가족 나들이 추천으로 돌아가기</a></footer>
    </div>
  )
}

function PreferenceWizard({ publicCode, participantSlot, meetingArea, onSubmit }) {
  const draftKey = `${DRAFT_KEY_PREFIX}${publicCode}:${participantSlot}`
  const [answers, setAnswers] = useState(() => {
    try {
      return { vetoes: [], ...JSON.parse(localStorage.getItem(draftKey) || '{}') }
    } catch {
      return { vetoes: [] }
    }
  })
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState('idle')
  const [notice, setNotice] = useState('')
  const question = preferenceQuestions[step]
  const isLast = step === preferenceQuestions.length - 1

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(answers))
  }, [answers, draftKey])

  const toggleVeto = (value) => {
    const selected = answers.vetoes || []
    if (selected.includes(value)) {
      setAnswers({ ...answers, vetoes: selected.filter((item) => item !== value) })
      setNotice('')
      return
    }
    if (selected.length >= 2) {
      setNotice('절대 싫은 조건은 두 개까지만 고를 수 있어요.')
      return
    }
    setAnswers({ ...answers, vetoes: [...selected, value] })
    setNotice('')
  }

  const handleNext = async () => {
    if (!answers[question.key]) return
    if (!isLast) {
      setStep((current) => current + 1)
      setNotice('')
      window.scrollTo({ top: 0 })
      return
    }
    setStatus('saving')
    setNotice('')
    try {
      await onSubmit(answers)
      localStorage.removeItem(draftKey)
    } catch (error) {
      setStatus('idle')
      setNotice(errorMessage(error))
    }
  }

  return (
    <main className="room-main wizard-main">
      <section className="wizard-card" aria-labelledby="question-title">
        <div className="room-context">
          <span>{meetingAreaMap[meetingArea]?.title}</span>
          <span>{participantSlot}님의 선택</span>
        </div>
        <div className="wizard-progress" aria-label={`질문 ${step + 1}/${preferenceQuestions.length}`}>
          <div><span style={{ width: `${(step + 1) / preferenceQuestions.length * 100}%` }} /></div>
          <strong>{step + 1} / {preferenceQuestions.length}</strong>
        </div>
        <p className="couple-eyebrow dark">{question.eyebrow}</p>
        <h1 id="question-title">{question.title}</h1>
        <p className="wizard-helper">{question.helper}</p>

        <fieldset className="wizard-options">
          <legend className="sr-only">{question.title}</legend>
          {question.options.map((option) => (
            <button
              type="button"
              className={answers[question.key] === option.value ? 'wizard-option active' : 'wizard-option'}
              aria-pressed={answers[question.key] === option.value}
              onClick={() => setAnswers({ ...answers, [question.key]: option.value })}
              key={option.value}
            >
              <span>{option.label}</span>
              <small>{answers[question.key] === option.value ? '선택됨 ✓' : '선택하기'}</small>
            </button>
          ))}
        </fieldset>

        {isLast && (
          <fieldset className="veto-panel">
            <legend>절대 싫은 조건 <span>선택 · 최대 2개</span></legend>
            <div>
              {vetoOptions.map((option) => (
                <button
                  type="button"
                  className={answers.vetoes?.includes(option.value) ? 'active' : ''}
                  aria-pressed={answers.vetoes?.includes(option.value)}
                  onClick={() => toggleVeto(option.value)}
                  key={option.value}
                >{option.label}</button>
              ))}
            </div>
          </fieldset>
        )}

        {notice && <p className="couple-alert" role="alert">{notice}</p>}
        <div className="wizard-actions">
          {step > 0 && <button className="couple-secondary" type="button" onClick={() => setStep((current) => current - 1)}>← 이전</button>}
          <button className="couple-primary" type="button" disabled={!answers[question.key] || status === 'saving'} onClick={handleNext}>
            {status === 'saving' ? '내 선택 저장 중…' : isLast ? '내 선택 완료' : '다음 질문'} <span aria-hidden="true">→</span>
          </button>
        </div>
        <p className="privacy-promise">🔒 상대방의 선택은 결과가 나오기 전까지 볼 수 없어요.</p>
      </section>
    </main>
  )
}

function WaitingRoom({ roomState, publicCode, realtimeConnected, onRefresh }) {
  const [shareNotice, setShareNotice] = useState('')
  const [manualShareText, setManualShareText] = useState('')
  const [manualInviteUrl, setManualInviteUrl] = useState('')
  const mobileShareAvailable = useMobileShareAvailability()
  const inviteSecret = localStorage.getItem(`${INVITE_KEY_PREFIX}${publicCode}`)
  const canInvite = roomState.participantSlot === 'A' && roomState.participantCount < 2 && inviteSecret
  const inviteUrl = canInvite ? buildInviteUrl(window.location.origin, publicCode, inviteSecret) : ''

  const copyInvite = async () => {
    setManualShareText('')
    setManualInviteUrl('')
    const result = await copyText(inviteUrl)
    if (result.status === 'copied') {
      setShareNotice('초대 링크를 복사했어요. 상대방에게 보내주세요.')
      return
    }
    setManualInviteUrl(result.text)
    setShareNotice('자동 복사가 되지 않았어요. 아래 초대 링크를 직접 복사해 주세요.')
  }

  const shareInvite = async () => {
    setManualShareText('')
    setManualInviteUrl('')
    const result = await sharePayload(buildInviteShare(inviteUrl))
    if (result.status === 'shared') setShareNotice('초대 공유창을 열었어요.')
    if (result.status === 'copied') setShareNotice('초대 문구와 비밀 링크를 복사했어요. 상대방에게 보내주세요.')
    if (result.status === 'cancelled') setShareNotice('공유를 취소했어요.')
    if (result.status === 'manual') {
      setManualShareText(result.text)
      setShareNotice('아래 비밀 초대 링크를 직접 복사해 주세요.')
    }
  }

  return (
    <main className="room-main waiting-main">
      <section className="waiting-card" aria-live="polite">
        <div className="waiting-illustration" aria-hidden="true">{roomState.participantCount < 2 ? '💌' : '⏳'}</div>
        <p className="couple-eyebrow dark">{meetingAreaMap[roomState.meetingArea]?.title}</p>
        <h1>{roomState.participantCount < 2 ? '상대방을 초대해 주세요' : '상대방의 선택을 기다리고 있어요'}</h1>
        <p>{roomState.participantCount < 2
          ? '링크를 받은 한 사람만 B로 참여할 수 있어요.'
          : `두 분 중 ${roomState.submittedCount}명이 선택을 마쳤어요.`}</p>
        <div className="participant-status" aria-label="참여 상태">
          <span className="done">A {roomState.participantSlot === 'A' ? '· 나' : ''} ✓</span>
          <span className={roomState.participantCount === 2 ? 'done' : ''}>B {roomState.participantSlot === 'B' ? '· 나' : ''} {roomState.participantCount === 2 ? '✓' : '대기'}</span>
        </div>
        {canInvite && (
          <>
            <div className="invite-actions">
              {mobileShareAvailable ? <button className="couple-primary" type="button" onClick={shareInvite}>상대방에게 공유하기 <span aria-hidden="true">↗</span></button> : null}
              <button className={mobileShareAvailable ? 'couple-secondary' : 'couple-primary'} type="button" onClick={copyInvite}>초대 링크 복사 <span aria-hidden="true">⧉</span></button>
            </div>
            <small className="invite-copy-guide">초대 링크를 복사해 상대방에게 보내주세요.</small>
          </>
        )}
        {roomState.participantSlot === 'A' && roomState.participantCount < 2 && !inviteSecret && (
          <p className="couple-alert">이 브라우저에서 초대 secret을 찾지 못했어요. 새 방을 만들어 주세요.</p>
        )}
        {shareNotice && <p className="share-notice" role="status">{shareNotice}</p>}
        {canInvite && manualInviteUrl && (
          <div className="manual-invite-fallback">
            <label htmlFor={`manual-invite-${publicCode}`}>직접 복사할 초대 링크</label>
            <input
              id={`manual-invite-${publicCode}`}
              className="manual-invite"
              type="text"
              readOnly
              value={manualInviteUrl}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
            />
          </div>
        )}
        {canInvite && manualShareText && <textarea className="manual-share" readOnly value={manualShareText} aria-label="직접 복사할 초대 문구" onFocus={(event) => event.currentTarget.select()} />}
        <button className="refresh-button" type="button" onClick={onRefresh}>상태 새로고침</button>
        <small className="connection-state">{realtimeConnected ? '● 실시간 연결됨' : '○ 10초마다 상태 확인 중'}</small>
      </section>
    </main>
  )
}

function ProcessingRoom({ notice, onRetry }) {
  return (
    <main className="room-main waiting-main">
      <section className="waiting-card" aria-live="polite">
        <div className="analysis-loader" aria-hidden="true"><span /><span /><span /></div>
        <p className="couple-eyebrow dark">둘의 취향을 맞추는 중</p>
        <h1>두 분 모두 선택을 마쳤어요</h1>
        <p>절대 싫은 조건을 지키면서 한쪽에 치우치지 않은 장소를 찾고 있어요.</p>
        {notice && <><p className="couple-alert" role="alert">{notice}</p><button className="couple-secondary" type="button" onClick={onRetry}>분석 다시 시도</button></>}
      </section>
    </main>
  )
}

function TerminalRoomState({ type, message }) {
  return (
    <main className="room-main waiting-main">
      <section className="waiting-card" aria-live="polite">
        <div className="waiting-illustration" aria-hidden="true">{type === 'expired' ? '⌛' : type === 'no_match' ? '🧭' : '🔒'}</div>
        <h1>{type === 'expired' ? '방이 만료됐어요' : type === 'no_match' ? '조건을 모두 지키는 장소가 없어요' : '방에 들어갈 수 없어요'}</h1>
        <p>{message}</p>
        <a className="couple-primary wide link" href="/couple">새 방에서 다시 고르기 <span aria-hidden="true">→</span></a>
      </section>
    </main>
  )
}

function CoupleRoom({ publicCode }) {
  const [sessionId, setSessionId] = useState(null)
  const [roomState, setRoomState] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [finalizeNotice, setFinalizeNotice] = useState('')
  const finalizingRef = useRef(false)

  const refresh = useCallback(async (targetSessionId) => {
    if (!targetSessionId) return
    const nextState = await getDecisionSessionState(targetSessionId)
    setRoomState(nextState)
    setStatus('ready')
  }, [])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      try {
        await ensureCoupleAuth()
        const inviteSecret = new URLSearchParams(window.location.hash.slice(1)).get('invite')
        const membership = inviteSecret
          ? await joinDecisionSession(publicCode, inviteSecret)
          : await resumeDecisionSession(publicCode)
        if (!membership?.session_id) {
          const missing = new Error('NOT_A_PARTICIPANT')
          missing.code = 'NOT_A_PARTICIPANT'
          throw missing
        }
        if (!active) return
        localStorage.setItem(`${SESSION_KEY_PREFIX}${publicCode}`, membership.session_id)
        if (inviteSecret) window.history.replaceState(null, '', `/couple/r/${publicCode}`)
        setSessionId(membership.session_id)
        await refresh(membership.session_id)
      } catch (nextError) {
        if (!active) return
        setError(nextError)
        setStatus('error')
      }
    }
    initialize()
    return () => { active = false }
  }, [publicCode, refresh])

  useEffect(() => {
    if (!sessionId) return undefined
    return subscribeToDecisionSession(
      sessionId,
      () => refresh(sessionId).catch(() => setRealtimeConnected(false)),
      (nextStatus) => setRealtimeConnected(nextStatus === 'SUBSCRIBED'),
    )
  }, [refresh, sessionId])

  useEffect(() => {
    if (!sessionId || realtimeConnected) return undefined
    const timer = window.setInterval(() => refresh(sessionId).catch(() => {}), 10000)
    return () => window.clearInterval(timer)
  }, [realtimeConnected, refresh, sessionId])

  const runFinalization = useCallback(async () => {
    if (!sessionId || finalizingRef.current) return
    finalizingRef.current = true
    setFinalizeNotice('')
    try {
      await finalizeDecisionSession(sessionId)
      await refresh(sessionId)
    } catch (nextError) {
      setFinalizeNotice(errorMessage(nextError))
    } finally {
      finalizingRef.current = false
    }
  }, [refresh, sessionId])

  useEffect(() => {
    if (roomState?.status === 'processing') runFinalization()
  }, [roomState?.status, runFinalization])

  useEffect(() => {
    if (roomState?.participantCount >= 2 || ['ready', 'no_match', 'expired'].includes(roomState?.status)) {
      localStorage.removeItem(`${INVITE_KEY_PREFIX}${publicCode}`)
    }
  }, [publicCode, roomState?.participantCount, roomState?.status])

  const handleSubmit = async (answers) => {
    await submitPreferenceResponse(sessionId, answers)
    await refresh(sessionId)
  }

  if (status === 'loading') return <><CoupleHeader compact /><main className="room-main waiting-main"><section className="waiting-card" aria-live="polite"><div className="analysis-loader"><span /><span /><span /></div><h1>둘만의 방을 여는 중…</h1></section></main></>
  if (status === 'error') return <><CoupleHeader compact /><TerminalRoomState type="error" message={errorMessage(error)} /></>
  if (roomState.status === 'expired') return <><CoupleHeader compact /><TerminalRoomState type="expired" message="개인정보를 오래 보관하지 않기 위해 생성 또는 완료 후 72시간이 지나면 방을 닫아요." /></>
  if (roomState.status === 'no_match') return <><CoupleHeader compact /><TerminalRoomState type="no_match" message={roomState.result?.compromiseText || '절대 싫은 조건을 몰래 완화하지 않았어요. 같은 권역에서 새로 골라보세요.'} /></>

  return (
    <div className="couple-page room-page">
      <CoupleHeader compact />
      {!roomState.mySubmitted && <PreferenceWizard publicCode={publicCode} participantSlot={roomState.participantSlot} meetingArea={roomState.meetingArea} onSubmit={handleSubmit} />}
      {roomState.mySubmitted && roomState.status === 'collecting' && <WaitingRoom roomState={roomState} publicCode={publicCode} realtimeConnected={realtimeConnected} onRefresh={() => refresh(sessionId)} />}
      {roomState.status === 'processing' && <ProcessingRoom notice={finalizeNotice} onRetry={runFinalization} />}
      {roomState.status === 'ready' && roomState.result && (
        <Suspense fallback={<ProcessingRoom notice="" onRetry={() => {}} />}>
          <CoupleResult roomState={roomState} />
        </Suspense>
      )}
    </div>
  )
}

export default function CoupleApp() {
  const roomMatch = window.location.pathname.match(ROOM_PATTERN)
  const isRoomPath = window.location.pathname.startsWith('/couple/r/')
  const publicCode = roomMatch?.[1] || ''

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
    robots.content = isRoomPath ? 'noindex,nofollow' : 'index,follow'
  }, [isRoomPath])

  if (isRoomPath && !publicCode) {
    return <><CoupleHeader compact /><TerminalRoomState type="error" message="방 주소 형식이 올바르지 않아요." /></>
  }
  return publicCode ? <CoupleRoom publicCode={publicCode} /> : <CoupleLanding />
}

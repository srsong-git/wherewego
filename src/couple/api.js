import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

export const coupleBackendReady = isSupabaseConfigured

function unwrapSingle(data) {
  return Array.isArray(data) ? data[0] : data
}

function throwSupabase(error) {
  if (!error) return
  const next = new Error(error.message || '요청을 처리하지 못했어요.')
  next.code = [
    'ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'ROOM_FULL', 'INVALID_INVITE',
    'NOT_A_PARTICIPANT', 'INVALID_ANSWERS', 'AUTH_REQUIRED',
    'CATALOG_UNAVAILABLE',
  ].find((code) => error.message?.includes(code)) || error.code
  throw next
}

function throwCode(code, fallback) {
  const next = new Error(code || fallback || '요청을 처리하지 못했어요.')
  next.code = code
  throw next
}

export async function ensureCoupleAuth() {
  if (!supabase) throw new Error('Supabase 연결이 필요합니다.')
  const { data, error } = await supabase.auth.getSession()
  throwSupabase(error)
  if (data.session) return data.session
  const { data: anonymousData, error: anonymousError } = await supabase.auth.signInAnonymously()
  throwSupabase(anonymousError)
  return anonymousData.session
}

export async function createDecisionSession(meetingArea) {
  const { data, error } = await supabase.rpc('create_decision_session', { target_meeting_area: meetingArea })
  throwSupabase(error)
  return unwrapSingle(data)
}

export async function joinDecisionSession(publicCode, inviteSecret) {
  const { data, error } = await supabase.rpc('join_decision_session', {
    target_public_code: publicCode,
    target_invite_secret: inviteSecret,
  })
  throwSupabase(error)
  return unwrapSingle(data)
}

export async function resumeDecisionSession(publicCode) {
  const { data, error } = await supabase.rpc('resume_decision_session', { target_public_code: publicCode })
  throwSupabase(error)
  return unwrapSingle(data)
}

export async function submitPreferenceResponse(sessionId, answers) {
  const { error } = await supabase.rpc('submit_preference_response', {
    target_session_id: sessionId,
    target_questionnaire_version: 'activity-v1',
    target_answers: answers,
  })
  throwSupabase(error)
}

export async function getDecisionSessionState(sessionId) {
  const { data, error } = await supabase.rpc('get_decision_session_state', { target_session_id: sessionId })
  throwSupabase(error)
  return data
}

export async function finalizeDecisionSession(sessionId) {
  const { data, error } = await supabase.functions.invoke('finalize-decision-session', {
    body: { sessionId },
  })
  if (error) {
    let code = data?.error
    if (!code && error.context?.clone) {
      try {
        code = (await error.context.clone().json())?.error
      } catch {
        // The generic function error below remains useful when the body is not JSON.
      }
    }
    if (code) throwCode(code, error.message)
    throwSupabase(error)
  }
  return data
}

export function subscribeToDecisionSession(sessionId, onChange, onStatus) {
  const channel = supabase
    .channel(`decision-session-${sessionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'decision_sessions',
      filter: `id=eq.${sessionId}`,
    }, onChange)
    .subscribe(onStatus)
  return () => supabase.removeChannel(channel)
}

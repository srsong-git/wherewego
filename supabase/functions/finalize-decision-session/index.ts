import { createClient } from 'npm:@supabase/supabase-js@2'
import { calculateConsensus, CONSENSUS_ALGORITHM_VERSION } from '../_shared/consensus.mjs'
import {
  loadCouplePlaces,
  prepareConsensusResultForPersistence,
  resolveCouplePlaceSource,
} from '../_shared/couple-catalog.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'AUTH_REQUIRED' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'FUNCTION_NOT_CONFIGURED' }, 500)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authorization.replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'AUTH_REQUIRED' }, 401)

  let payload: { sessionId?: string }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'INVALID_BODY' }, 400)
  }
  if (!payload.sessionId) return json({ error: 'SESSION_ID_REQUIRED' }, 400)

  const { data: participant } = await serviceClient
    .from('session_participants')
    .select('id')
    .eq('session_id', payload.sessionId)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!participant) return json({ error: 'NOT_A_PARTICIPANT' }, 403)

  const { data: session, error: sessionError } = await serviceClient
    .from('decision_sessions')
    .select('*')
    .eq('id', payload.sessionId)
    .single()
  if (sessionError || !session) return json({ error: 'ROOM_NOT_FOUND' }, 404)
  if (session.status === 'ready' || session.status === 'no_match') return json({ status: session.status, finalized: false })
  if (session.status === 'expired' || new Date(session.expires_at).getTime() <= Date.now()) {
    await serviceClient.from('decision_sessions').update({ status: 'expired' }).eq('id', session.id)
    return json({ error: 'ROOM_EXPIRED' }, 410)
  }
  if (session.status !== 'processing' || session.submitted_count !== 2) {
    return json({ error: 'ROOM_NOT_READY_FOR_FINALIZATION' }, 409)
  }

  const { data: responses, error: responsesError } = await serviceClient
    .from('preference_responses')
    .select('answers, session_participants!inner(slot)')
    .eq('session_id', session.id)
  if (responsesError || responses?.length !== 2) return json({ error: 'RESPONSES_NOT_READY' }, 409)

  const orderedAnswers = [...responses]
    .sort((left, right) => left.session_participants.slot.localeCompare(right.session_participants.slot))
    .map((response) => response.answers)

  let placeSource: string
  try {
    placeSource = resolveCouplePlaceSource(Deno.env.get('COUPLE_PLACE_SOURCE'))
  } catch (error) {
    console.error('Invalid COUPLE_PLACE_SOURCE configuration', error instanceof Error ? error.message : error)
    return json({ error: 'FUNCTION_NOT_CONFIGURED' }, 500)
  }

  let catalog
  try {
    catalog = await loadCouplePlaces({
      source: placeSource,
      meetingArea: session.meeting_area,
      serviceClient,
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'CATALOG_UNAVAILABLE') {
      console.error('Production Couple catalog unavailable')
      return json({ error: 'CATALOG_UNAVAILABLE' }, 503)
    }
    console.error('Couple place source failed', error instanceof Error ? error.message : error)
    return json({ error: 'FINALIZATION_FAILED' }, 500)
  }

  const consensusResult = calculateConsensus({
    meetingArea: session.meeting_area,
    answers: orderedAnswers,
    places: catalog.places,
  })
  const result = prepareConsensusResultForPersistence(consensusResult, {
    datasetVersion: catalog.datasetVersion,
    algorithmVersion: CONSENSUS_ALGORITHM_VERSION,
  })

  const { data: completed, error: completionError } = await serviceClient.rpc('complete_decision_session', {
    target_session_id: session.id,
    target_result: result,
  })
  if (completionError) {
    console.error('complete_decision_session failed', completionError)
    return json({ error: 'FINALIZATION_FAILED' }, 500)
  }
  return json({ status: result.status, finalized: completed })
})

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export const FIXTURE_DATASET_VERSION = 'couple-fixture-v1'

const MEETING_AREA_ALIASES = Object.freeze({
  jongno: 'jongno_euljiro',
})

export function normalizeMeetingArea(value) {
  return MEETING_AREA_ALIASES[value] || value
}

const DEFAULT_ANSWERS = Object.freeze({
  activity: 'any',
  energy: 'medium',
  novelty: 'balanced',
  budget: 'any',
  duration: 'unlimited',
  vetoes: [],
})

const FORBIDDEN_METADATA_PATTERN = /(editorial|human|evidence|recommendationitemid|curation|internal)/i
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {}
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
      }),
  )
}

function readConfig() {
  const fileEnv = parseEnvFile(resolve(process.cwd(), '.env.local'))
  const supabaseUrl = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    throw new Error('VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY가 필요합니다.')
  }
  return { supabaseUrl, publishableKey }
}

function getArg(name, fallback) {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  return value || fallback
}

function unwrapSingle(data) {
  return Array.isArray(data) ? data[0] : data
}

function publicError(error) {
  if (!error) return null
  return {
    name: error.name || null,
    code: error.code || null,
    status: error.status || null,
    message: error.message || String(error),
  }
}

function makeClient(supabaseUrl, publishableKey) {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function recommendationItems(result) {
  return [...(result?.items || [])].sort((left, right) => left.rank - right.rank)
}

export function canonicalRecommendationPayload(result) {
  return {
    datasetVersion: result?.datasetVersion ?? null,
    algorithmVersion: result?.algorithmVersion ?? null,
    agreementScore: result?.agreementScore ?? null,
    sharedPoints: [...(result?.sharedPoints || [])],
    differencePoints: [...(result?.differencePoints || [])],
    compromiseText: result?.compromiseText ?? null,
    items: recommendationItems(result).map((item) => ({
      rank: item.rank ?? null,
      role: item.role ?? null,
      placeId: item.placeId ?? null,
      score: item.score ?? null,
      reason: item.reason ?? null,
    })),
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  )
}

export function meaningfulResultsEqual(left, right) {
  return JSON.stringify(stableValue(canonicalRecommendationPayload(left)))
    === JSON.stringify(stableValue(canonicalRecommendationPayload(right)))
}

function collectForbiddenMetadata(value, path = 'result', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenMetadata(item, `${path}[${index}]`, found))
    return found
  }
  if (!value || typeof value !== 'object') return found
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (FORBIDDEN_METADATA_PATTERN.test(key)) found.push(childPath)
    collectForbiddenMetadata(child, childPath, found)
  }
  return found
}

function collectPublicUuidPaths(value, path = 'result', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPublicUuidPaths(item, `${path}[${index}]`, found))
    return found
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectPublicUuidPaths(child, `${path}.${key}`, found)
    }
    return found
  }
  if (typeof value === 'string' && UUID_PATTERN.test(value)) found.push(path)
  return found
}

function placeIds(result) {
  return recommendationItems(result).map((item) => ({ rank: item.rank, placeId: item.placeId }))
}

function scoreReasons(result) {
  return recommendationItems(result).map((item) => ({
    rank: item.rank,
    score: item.score,
    reason: item.reason,
  }))
}

function placeIdentityChecks(result) {
  return recommendationItems(result).map((item) => ({
    rank: item.rank,
    placeId: item.placeId ?? null,
    snapshotId: item.place?.id ?? null,
    matches: Boolean(item.placeId) && item.placeId === item.place?.id,
  }))
}

function equalActual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
}

export function buildCanaryChecks({
  finalizeData,
  finalizeError,
  stateA,
  stateB,
  restoreSessionError,
  restoreStateError,
  restoredState,
  expectedDatasetVersion,
}) {
  const resultA = stateA?.result || null
  const resultB = stateB?.result || null
  const restoredResult = restoredState?.result || null
  const idsA = placeIds(resultA)
  const idsB = placeIds(resultB)
  const restoredIds = placeIds(restoredResult)
  const scoresA = scoreReasons(resultA)
  const scoresB = scoreReasons(resultB)
  const forbiddenPaths = collectForbiddenMetadata(resultA)
  const uuidPaths = collectPublicUuidPaths(resultA)
  const identity = placeIdentityChecks(resultA)
  const canonicalA = canonicalRecommendationPayload(resultA)
  const canonicalB = canonicalRecommendationPayload(resultB)

  return {
    finalizeSucceeded: {
      pass: !finalizeError && finalizeData?.status === 'ready' && finalizeData?.finalized === true,
      actual: { data: finalizeData || null, error: publicError(finalizeError) },
    },
    aResultExists: {
      pass: Boolean(resultA),
      actual: Boolean(resultA),
    },
    bResultExists: {
      pass: Boolean(resultB),
      actual: Boolean(resultB),
    },
    aDatasetVersion: {
      pass: resultA?.datasetVersion === expectedDatasetVersion,
      actual: resultA?.datasetVersion ?? null,
      expected: expectedDatasetVersion,
    },
    bDatasetVersion: {
      pass: resultB?.datasetVersion === expectedDatasetVersion,
      actual: resultB?.datasetVersion ?? null,
      expected: expectedDatasetVersion,
    },
    itemCounts: {
      pass: recommendationItems(resultA).length >= 1
        && recommendationItems(resultA).length <= 3
        && recommendationItems(resultA).length === recommendationItems(resultB).length,
      actual: { a: recommendationItems(resultA).length, b: recommendationItems(resultB).length },
    },
    placeIdsByRank: {
      pass: equalActual(idsA, idsB),
      actual: { a: idsA, b: idsB },
    },
    scoresAndReasonsByRank: {
      pass: equalActual(scoresA, scoresB),
      actual: { a: scoresA, b: scoresB },
    },
    meaningfulRecommendationPayload: {
      pass: meaningfulResultsEqual(resultA, resultB),
      actual: { a: canonicalA, b: canonicalB },
    },
    newClientSessionRestored: {
      pass: !restoreSessionError && !restoreStateError && Boolean(restoredResult),
      actual: {
        sessionError: publicError(restoreSessionError),
        stateError: publicError(restoreStateError),
        resultExists: Boolean(restoredResult),
      },
    },
    restoredPlaceIdsByRank: {
      pass: equalActual(idsA, restoredIds),
      actual: { before: idsA, after: restoredIds },
    },
    restoredDatasetVersion: {
      pass: resultA?.datasetVersion === restoredResult?.datasetVersion,
      actual: {
        before: resultA?.datasetVersion ?? null,
        after: restoredResult?.datasetVersion ?? null,
      },
    },
    forbiddenMetadataExposure: {
      pass: forbiddenPaths.length === 0,
      actual: { exposed: forbiddenPaths.length > 0, paths: forbiddenPaths },
    },
    publicUuidExposure: {
      pass: uuidPaths.length === 0,
      actual: { exposed: uuidPaths.length > 0, count: uuidPaths.length, paths: uuidPaths },
    },
    publicPlaceIdentity: {
      pass: identity.length > 0 && identity.every((item) => item.matches),
      actual: identity,
    },
  }
}

async function rpc(client, name, args) {
  const response = await client.rpc(name, args)
  if (response.error) throw response.error
  return response.data
}

export async function runCanary({
  supabaseUrl,
  publishableKey,
  meetingArea = 'seongsu',
  expectedDatasetVersion = FIXTURE_DATASET_VERSION,
  answersA = DEFAULT_ANSWERS,
  answersB = DEFAULT_ANSWERS,
}) {
  const clientA = makeClient(supabaseUrl, publishableKey)
  const clientB = makeClient(supabaseUrl, publishableKey)
  const authA = await clientA.auth.signInAnonymously()
  const authB = await clientB.auth.signInAnonymously()
  if (authA.error || authB.error) throw authA.error || authB.error

  const room = unwrapSingle(await rpc(clientA, 'create_decision_session', {
    target_meeting_area: meetingArea,
  }))

  await rpc(clientA, 'submit_preference_response', {
    target_session_id: room.session_id,
    target_questionnaire_version: 'activity-v1',
    target_answers: answersA,
  })
  await rpc(clientB, 'join_decision_session', {
    target_public_code: room.public_code,
    target_invite_secret: room.invite_secret,
  })
  await rpc(clientB, 'submit_preference_response', {
    target_session_id: room.session_id,
    target_questionnaire_version: 'activity-v1',
    target_answers: answersB,
  })

  const finalizeResponse = await clientA.functions.invoke('finalize-decision-session', {
    body: { sessionId: room.session_id },
  })
  const stateAResponse = await clientA.rpc('get_decision_session_state', {
    target_session_id: room.session_id,
  })
  const stateBResponse = await clientB.rpc('get_decision_session_state', {
    target_session_id: room.session_id,
  })

  const restoredClient = makeClient(supabaseUrl, publishableKey)
  const restoreSessionResponse = await restoredClient.auth.setSession({
    access_token: authA.data.session.access_token,
    refresh_token: authA.data.session.refresh_token,
  })
  const restoreStateResponse = restoreSessionResponse.error
    ? { data: null, error: new Error('SESSION_RESTORE_FAILED') }
    : await restoredClient.rpc('get_decision_session_state', { target_session_id: room.session_id })

  const checks = buildCanaryChecks({
    finalizeData: finalizeResponse.data,
    finalizeError: finalizeResponse.error,
    stateA: stateAResponse.data,
    stateB: stateBResponse.data,
    restoreSessionError: restoreSessionResponse.error,
    restoreStateError: restoreStateResponse.error,
    restoredState: restoreStateResponse.data,
    expectedDatasetVersion,
  })
  const overallPass = Object.values(checks).every((check) => check.pass)
  const recommendations = recommendationItems(stateAResponse.data?.result).map((item) => ({
    rank: item.rank,
    placeId: item.placeId,
    name: item.place?.name || null,
    score: item.score,
    reason: item.reason,
  }))

  return {
    meetingArea,
    expectedDatasetVersion,
    authContextsIndependent: authA.data.user.id !== authB.data.user.id,
    overallPass,
    checks,
    recommendations,
  }
}

async function main() {
  try {
    const { supabaseUrl, publishableKey } = readConfig()
    const report = await runCanary({
      supabaseUrl,
      publishableKey,
      meetingArea: normalizeMeetingArea(getArg('area', 'seongsu')),
      expectedDatasetVersion: getArg('expected-dataset', FIXTURE_DATASET_VERSION),
    })
    console.log(JSON.stringify(report, null, 2))
    if (!report.overallPass) process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({
      overallPass: false,
      fatalError: publicError(error),
    }, null, 2))
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) await main()

export const SAFE_COUPLE_URL = 'https://oneulwhere.kr/couple'

export function buildSafeResultShare(result) {
  const primaryName = result?.items?.[0]?.place?.name?.replace(/^\[Fixture\]\s*/, '') || '오늘의 장소'
  const text = `오늘의 취향 겹침 ${result?.agreementScore ?? 0}% · 오늘 추천은 ${primaryName}! 각자 고르면, 오늘 어디가지가 맞춰드려요.`
  return { title: '오늘 우리 둘 어디가지?', text, url: SAFE_COUPLE_URL }
}

export function buildInviteShare(url) {
  return {
    title: '오늘 우리 둘 어디가지?',
    text: '내 취향은 골랐어요. 상대 선택은 보이지 않으니 솔직하게 골라주세요.',
    url,
  }
}

export function buildInviteUrl(origin, publicCode, inviteSecret) {
  return `${origin.replace(/\/$/, '')}/couple/r/${publicCode}#invite=${inviteSecret}`
}

export async function copyText(text, clipboard = globalThis.navigator?.clipboard) {
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text)
      return { mode: 'clipboard', status: 'copied' }
    } catch {
      // Fall through to a manually selectable field.
    }
  }
  return { mode: 'manual', status: 'manual', text }
}

export function shouldOfferMobileShare({ hasShare, isMobile }) {
  return Boolean(hasShare && isMobile)
}

export async function sharePayload(payload) {
  if (navigator.share) {
    try {
      await navigator.share(payload)
      return { mode: 'share', status: 'shared' }
    } catch (error) {
      if (error?.name === 'AbortError') return { mode: 'share', status: 'cancelled' }
    }
  }

  const clipboardText = `${payload.text}\n${payload.url}`
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(clipboardText)
      return { mode: 'clipboard', status: 'copied' }
    } catch {
      // Fall through to a manually selectable text field.
    }
  }
  return { mode: 'manual', status: 'manual', text: clipboardText }
}

export function ensureUrl(link: string | null | undefined): string | null {
  if (!link) return null
  const trimmed = link.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function telegramLink(handle: string | null | undefined): string | null {
  if (!handle) return null
  const trimmed = handle.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://t.me/${trimmed.replace(/^@/, '')}`
}

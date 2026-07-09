export function matchesSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f?.toLowerCase().includes(q))
}

export function withinDateRange(date: Date | string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date

  if (from && d < new Date(from)) return false
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    if (d > end) return false
  }
  return true
}

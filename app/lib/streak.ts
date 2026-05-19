export function calculateStreak(logs: { date: string }[]): number {
  if (!logs.length) return 0

  const logDates = new Set(logs.map(l => l.date))

  let streak = 0
  const d = new Date()

  // Use local date string to match how Supabase stores dates
  const toLocalDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // If today isn't logged yet, start checking from yesterday
  const todayStr = toLocalDate(d)
  if (!logDates.has(todayStr)) {
    d.setDate(d.getDate() - 1)
  }

  while (true) {
    const dateStr = toLocalDate(d)
    if (logDates.has(dateStr)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

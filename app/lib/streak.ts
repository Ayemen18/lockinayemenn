export function calculateStreak(logs: { date: string }[]): number {
  if (!logs.length) return 0

  // Build a set of all logged dates
  const logDates = new Set(logs.map(l => l.date))

  // Get today's local date
  const toLocalDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const todayStr = toLocalDate(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayStr = toLocalDate(yesterdayDate)

  // Streak must include today OR yesterday to be active
  // If neither today nor yesterday is logged, streak is 0
  if (!logDates.has(todayStr) && !logDates.has(yesterdayStr)) {
    return 0
  }

  // Start from today if logged, otherwise yesterday
  const startDate = new Date()
  if (!logDates.has(todayStr)) {
    startDate.setDate(startDate.getDate() - 1)
  }

  let streak = 0
  const d = new Date(startDate)

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

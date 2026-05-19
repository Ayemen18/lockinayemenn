export function calculateStreak(logs: { date: string, score: number }[]): number {
  if (!logs.length) return 0

  // Only count days where something was actually logged
  const logDates = new Set(
    logs.filter(l => l.score > 0).map(l => l.date)
  )

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

  if (!logDates.has(todayStr) && !logDates.has(yesterdayStr)) {
    return 0
  }

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

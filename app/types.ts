export type Log = {
  date: string
  score: number
  earned_points: number
  total_points: number
  completed_habit_ids: string[]
  study_hours?: number | null
  sleep_time?: string | null
  reflection?: string | null
}

export type Habit = {
  id: string
  name: string
  category: string
  points: number
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import LeetCodeCard from '../components/LeetCodeCard'

type Habit = {
  id: string
  name: string
  category: string
  points: number
  sort_order: number
}

const categoryColors: Record<string, string> = {
  sleep:   'text-blue-400 bg-blue-950/60 border border-blue-900/20',
  study:   'text-green-400 bg-green-950/60 border border-green-900/20',
  health:  'text-orange-400 bg-orange-950/60 border border-orange-900/20',
  mindset: 'text-purple-400 bg-purple-950/60 border border-purple-900/20',
}

export default function JournalPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [habits, setHabits] = useState<Habit[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [studyHours, setStudyHours] = useState('')
  const [sleepTime, setSleepTime] = useState('')
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alreadySaved, setAlreadySaved] = useState(false)
  const [leetcodeHabitId, setLeetcodeHabitId] = useState<string | null>(null)

  // LeetCode Solved & Bonus States
  const [leetcodeSolved, setLeetcodeSolved] = useState(0)
  const [leetcodeBonus, setLeetcodeBonus] = useState(0)

  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: habitsData } = await supabase
        .from('habits').select('*').eq('user_id', user.id).order('sort_order')

      if (habitsData) {
        setHabits(habitsData)
        const lcHabit = habitsData.find((h: Habit) =>
          h.name.toLowerCase().includes('leetcode')
        )
        if (lcHabit) setLeetcodeHabitId(lcHabit.id)
      }

      const { data: existingLog } = await supabase
        .from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).maybeSingle()

      if (existingLog) {
        setAlreadySaved(true)
        setChecked(new Set(existingLog.completed_habit_ids || []))
        setStudyHours(existingLog.study_hours?.toString() || '')
        setSleepTime(existingLog.sleep_time || '')
        setReflection(existingLog.reflection || '')
        setLeetcodeSolved(existingLog.leetcode_solved || 0)
        setLeetcodeBonus(existingLog.leetcode_bonus_points || 0)
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleLeetCodeSync(solvedToday: number) {
    setLeetcodeSolved(solvedToday)

    // Bonus points: 5 base + 2 per extra problem, capped at 20
    const bonus = solvedToday > 0
      ? Math.min(5 + (solvedToday - 1) * 2, 20)
      : 0
    setLeetcodeBonus(bonus)

    // Auto-check LeetCode habit if exists
    if (solvedToday > 0 && leetcodeHabitId) {
      setChecked(prev => {
        const next = new Set(prev)
        next.add(leetcodeHabitId)
        return next
      })
    }
  }

  const totalPoints = habits.reduce((s, h) => s + h.points, 0)
  const earnedPoints = habits.filter(h => checked.has(h.id)).reduce((s, h) => s + h.points, 0)
  const totalWithBonus = totalPoints + (leetcodeSolved > 0 ? 20 : 0) // max possible
  const earnedWithBonus = earnedPoints + leetcodeBonus
  const score = totalWithBonus > 0
    ? Math.round((earnedWithBonus / totalWithBonus) * 100)
    : 0

  async function save() {
    if (checked.size === 0) {
      alert('Check at least one habit before saving.')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('daily_logs').upsert({
      user_id: user.id,
      date: today,
      completed_habit_ids: Array.from(checked),
      total_points: totalWithBonus,
      earned_points: earnedWithBonus,
      score,
      study_hours: parseFloat(studyHours) || null,
      sleep_time: sleepTime || null,
      reflection: reflection || null,
      leetcode_solved: leetcodeSolved,
      leetcode_bonus_points: leetcodeBonus,
    }, { onConflict: 'user_id,date' })

    setSaving(false)
    setAlreadySaved(true)
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-neutral-700 font-mono"
        >loading daily check-in...</motion.div>
      </div>
    )
  }

  return (
    <div className="text-neutral-100 font-sans">
      <div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column (2/3 width) - Checklist */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Title block */}
            <FadeIn className="flex items-end justify-between border-b border-neutral-900 pb-5">
              <div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-neutral-600 hover:text-neutral-400 text-xs font-mono mb-2 block transition-colors uppercase tracking-wider"
                >
                  ← back
                </button>
                <h1 className="text-xl font-bold tracking-tight text-white">Daily Check-In</h1>
                <p className="text-xs text-neutral-500 font-mono mt-1">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </FadeIn>

            {/* Checklist items */}
            <FadeIn delay={0.05} className="bg-neutral-900/20 border border-neutral-800/40 rounded-2xl overflow-hidden">
              <FadeInStagger>
                {habits.map((habit, i) => (
                  <StaggerItem key={habit.id}>
                    <motion.div
                      onClick={() => toggle(habit.id)}
                      whileTap={{ scale: 0.995 }}
                      className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-neutral-900/60 select-none ${
                        i !== habits.length - 1 ? 'border-b border-neutral-800/40' : ''
                      } ${checked.has(habit.id) ? 'bg-neutral-900/10' : ''}`}
                    >
                      {/* Check indicator */}
                      <motion.div
                        initial={{ borderColor: '#262626' }}
                        animate={{
                          borderColor: checked.has(habit.id) ? '#22c55e' : '#262626',
                          backgroundColor: checked.has(habit.id) ? 'rgba(34, 197, 94, 0.06)' : 'rgba(0, 0, 0, 0)',
                        }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        style={{ borderStyle: 'solid', borderWidth: '1px' }}
                        className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                      >
                        <AnimatePresence>
                          {checked.has(habit.id) && (
                            <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                              <motion.path
                                d="M1 4.2l2.3 2.3L9 1.5"
                                stroke="#22c55e"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                exit={{ pathLength: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                              />
                            </svg>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      
                      {/* Animated Strikethrough Text */}
                      <span className="flex-1 text-sm font-medium relative py-0.5">
                        <span className={`inline-block transition-colors duration-300 ${
                          checked.has(habit.id) ? 'text-neutral-500' : 'text-neutral-200'
                        }`}>
                          {habit.name}
                        </span>
                        
                        {/* Custom Strikethrough Line */}
                        <motion.span
                          initial={{ width: '0%' }}
                          animate={{ width: checked.has(habit.id) ? '100%' : '0%' }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute left-0 top-1/2 h-[1px] bg-neutral-600 pointer-events-none"
                        />
                      </span>
                      
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-medium tracking-wide ${categoryColors[habit.category]}`}>
                        {habit.points} pts
                      </span>
                    </motion.div>
                  </StaggerItem>
                ))}
              </FadeInStagger>

              {habits.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-sm text-neutral-500 font-mono mb-2">No habits configured yet.</p>
                  <button
                    onClick={() => router.push('/habits')}
                    className="text-xs text-white underline underline-offset-4 hover:text-neutral-350 font-mono"
                  >
                    Go configure habits
                  </button>
                </div>
              )}
            </FadeIn>
          </div>

          {/* Right Column (1/3 width) - Sticky Inputs Console */}
          <div className="space-y-6 lg:sticky lg:top-24">
            
            {/* LeetCode Card auto-sync status */}
            {leetcodeHabitId && (
              <FadeIn className="mb-5">
                <LeetCodeCard onTodaySolved={handleLeetCodeSync} />
              </FadeIn>
            )}

            {/* Score & Save Console Card */}
            <FadeIn delay={0.1} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 space-y-5">
              
              {/* Score breakdown */}
              <div className="flex items-center justify-between border-b border-neutral-800/60 pb-4">
                <div>
                  <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Progress Score</p>
                  <p className="text-[11px] text-neutral-600 font-mono mt-1">{earnedWithBonus} / {totalWithBonus} pts</p>
                  {leetcodeBonus > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-yellow-400 font-mono bg-yellow-950/60 px-2 py-0.5 rounded-full">
                        +{leetcodeBonus} LC bonus
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <motion.div
                    key={score}
                    initial={{ opacity: 0.5, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-3xl font-bold text-white tracking-tight"
                  >
                    {score}%
                  </motion.div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-neutral-950 border border-neutral-900 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  className="h-full bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                />
              </div>

              {/* Numeric Parameters */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Study hours</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={studyHours}
                    onChange={e => setStudyHours(e.target.value)}
                    placeholder="e.g. 4.5"
                    className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-800 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Sleep time</label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={e => setSleepTime(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Reflection */}
              <div>
                <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Reflection</label>
                <textarea
                  value={reflection}
                  onChange={e => setReflection(e.target.value)}
                  placeholder="How was today? What could be better tomorrow?"
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors resize-none placeholder:text-neutral-800 leading-relaxed font-sans"
                />
              </div>

              {/* Save Trigger Button */}
              <div className="pt-2">
                <motion.button
                  onClick={save}
                  disabled={saving}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-white text-black text-xs font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40 tracking-tight"
                >
                  {saving ? (
                    <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                      Saving Log...
                    </motion.span>
                  ) : alreadySaved ? `Update Log — ${score}%` : `Save Log — ${score}%`}
                </motion.button>
              </div>

            </FadeIn>
          </div>

        </div>

      </div>
    </div>
  )
}
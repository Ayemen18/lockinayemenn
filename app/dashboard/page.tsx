'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import { calculateStreak } from '../lib/streak'
import HistoryModal from '../components/HistoryModal'
import type { Log, Habit } from '../types'

const quotes = [
  { min: 90, text: "Elite execution. You're building something real." },
  { min: 75, text: "Strong day. Consistency is the whole game." },
  { min: 60, text: "Decent. You know what needs to be fixed tomorrow." },
  { min: 0,  text: "Rough day. Show up again tomorrow anyway." },
]

const notLoggedQuotes = [
  "The log doesn't fill itself.",
  "Every day unlogged is data lost.",
  "Your future self is watching.",
  "Don't break the chain.",
]

export default function DashboardPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [logs, setLogs] = useState<Log[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // Live checklist states
  const [todayCompletedIds, setTodayCompletedIds] = useState<string[]>([])
  const [todayStudyHours, setTodayStudyHours] = useState<number | null>(null)
  const [todaySleepTime, setTodaySleepTime] = useState<string | null>(null)
  const [todayReflection, setTodayReflection] = useState<string | null>(null)
  const [todayLeetcodeSolved, setTodayLeetcodeSolved] = useState(0)
  const [todayLeetcodeBonus, setTodayLeetcodeBonus] = useState(0)

  // Forecast/Simulator states
  const [forecastMode, setForecastMode] = useState(false)
  const [forecastCompletedIds, setForecastCompletedIds] = useState<string[]>([])

  // Squad info state
  const [squadInfo, setSquadInfo] = useState<{
    squadName: string
    members: { name: string; isSelf: boolean; score: number | null }[]
  } | null>(null)

  const [savingChecklist, setSavingChecklist] = useState(false)

  // Modal inspection states
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')
      
      const { data: logsData } = await supabase
        .from('daily_logs').select('*')
        .eq('user_id', user.id).order('date', { ascending: true })
      if (logsData) {
        setLogs(logsData as Log[])
        // Sync today's logged states to checklist
        const todayL = logsData.find(l => l.date === today)
        if (todayL) {
          setTodayCompletedIds(todayL.completed_habit_ids || [])
          setTodayStudyHours(todayL.study_hours ?? null)
          setTodaySleepTime(todayL.sleep_time ?? null)
          setTodayReflection(todayL.reflection ?? null)
          setTodayLeetcodeSolved(todayL.leetcode_solved ?? 0)
          setTodayLeetcodeBonus(todayL.leetcode_bonus_points ?? 0)
        }
      }

      const { data: habitsData } = await supabase
        .from('habits').select('*')
        .eq('user_id', user.id)
      if (habitsData) setHabits(habitsData as Habit[])

      // Fetch active squad statistics for mini peer radar
      try {
        const { data: memberRows } = await supabase
          .from('squad_members')
          .select('squad_id')
          .eq('user_id', user.id)
        if (memberRows && memberRows.length > 0) {
          const squadId = memberRows[0].squad_id
          const { data: squad } = await supabase
            .from('squads')
            .select('name')
            .eq('id', squadId)
            .single()
          
          const { data: members } = await supabase
            .from('squad_members')
            .select('user_id, display_name')
            .eq('squad_id', squadId)
          
          if (squad && members) {
            const memberIds = members.map(m => m.user_id)
            const { data: todayLogs } = await supabase
              .from('daily_logs')
              .select('user_id, score')
              .in('user_id', memberIds)
              .eq('date', today)
            
            const stats = members.map(m => {
              const loggedScore = todayLogs?.find(l => l.user_id === m.user_id)
              return {
                name: m.display_name,
                isSelf: m.user_id === user.id,
                score: loggedScore ? loggedScore.score : null
              }
            })
            
            stats.sort((a,b) => {
              if (a.score !== null && b.score === null) return -1
              if (a.score === null && b.score !== null) return 1
              return (b.score || 0) - (a.score || 0)
            })
            
            setSquadInfo({
              squadName: squad.name,
              members: stats
            })
          }
        }
      } catch (err) {
        console.warn('Failed to load squad metrics for peer dashboard feed:', err)
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-neutral-700 font-mono"
        >loading...</motion.div>
      </div>
    )
  }

  // Auto-Save Habit Checklist function
  async function toggleTodayHabit(habitId: string) {
    let nextIds: string[]
    if (forecastMode) {
      nextIds = forecastCompletedIds.includes(habitId)
        ? forecastCompletedIds.filter(id => id !== habitId)
        : [...forecastCompletedIds, habitId]
      setForecastCompletedIds(nextIds)
      return
    }

    nextIds = todayCompletedIds.includes(habitId)
      ? todayCompletedIds.filter(id => id !== habitId)
      : [...todayCompletedIds, habitId]
    
    setTodayCompletedIds(nextIds)
    setSavingChecklist(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingChecklist(false)
      return
    }

    const totalPoints = habits.reduce((s, h) => s + h.points, 0)
    const earnedPoints = habits.filter(h => nextIds.includes(h.id)).reduce((s, h) => s + h.points, 0)
    const totalWithBonus = totalPoints + (todayLeetcodeSolved > 0 ? 20 : 0)
    const earnedWithBonus = earnedPoints + todayLeetcodeBonus
    const calculatedScore = totalWithBonus > 0 ? Math.round((earnedWithBonus / totalWithBonus) * 100) : 0

    const payload = {
      user_id: user.id,
      date: today,
      completed_habit_ids: nextIds,
      total_points: totalWithBonus,
      earned_points: earnedWithBonus,
      score: calculatedScore,
      study_hours: todayStudyHours,
      sleep_time: todaySleepTime,
      reflection: todayReflection,
      leetcode_solved: todayLeetcodeSolved,
      leetcode_bonus_points: todayLeetcodeBonus
    }

    const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,date' })
    if (!error) {
      setLogs(prev => {
        const idx = prev.findIndex(l => l.date === today)
        const newLog = {
          ...payload,
          study_hours: todayStudyHours,
          sleep_time: todaySleepTime,
          reflection: todayReflection
        } as Log
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = newLog
          return next
        } else {
          return [...prev, newLog]
        }
      })
    }
    setSavingChecklist(false)
  }

  // Toggle and Initialize Forecast state
  const toggleForecast = () => {
    if (!forecastMode) {
      setForecastCompletedIds(todayCompletedIds)
    }
    setForecastMode(!forecastMode)
  }

  // Apply forecasted items to database
  async function applyForecast() {
    setForecastMode(false)
    setTodayCompletedIds(forecastCompletedIds)
    setSavingChecklist(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingChecklist(false)
      return
    }

    const totalPoints = habits.reduce((s, h) => s + h.points, 0)
    const earnedPoints = habits.filter(h => forecastCompletedIds.includes(h.id)).reduce((s, h) => s + h.points, 0)
    const totalWithBonus = totalPoints + (todayLeetcodeSolved > 0 ? 20 : 0)
    const earnedWithBonus = earnedPoints + todayLeetcodeBonus
    const calculatedScore = totalWithBonus > 0 ? Math.round((earnedWithBonus / totalWithBonus) * 100) : 0

    const payload = {
      user_id: user.id,
      date: today,
      completed_habit_ids: forecastCompletedIds,
      total_points: totalWithBonus,
      earned_points: earnedWithBonus,
      score: calculatedScore,
      study_hours: todayStudyHours,
      sleep_time: todaySleepTime,
      reflection: todayReflection,
      leetcode_solved: todayLeetcodeSolved,
      leetcode_bonus_points: todayLeetcodeBonus
    }

    const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,date' })
    if (!error) {
      setLogs(prev => {
        const idx = prev.findIndex(l => l.date === today)
        const newLog = {
          ...payload,
          study_hours: todayStudyHours,
          sleep_time: todaySleepTime,
          reflection: todayReflection
        } as Log
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = newLog
          return next
        } else {
          return [...prev, newLog]
        }
      })
    }
    setSavingChecklist(false)
  }

  const todayLog = logs.find(l => l.date === today)
  const streak = calculateStreak(logs)
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length) : 0
  const consistency = logs.length > 0
    ? Math.round((logs.filter(l => l.score >= 60).length / logs.length) * 100) : 0

  // Calculate live dynamic metrics for header card
  const activeCompletedIds = forecastMode ? forecastCompletedIds : todayCompletedIds
  const totalPoints = habits.reduce((s, h) => s + h.points, 0)
  const earnedPoints = habits.filter(h => activeCompletedIds.includes(h.id)).reduce((s, h) => s + h.points, 0)
  const totalWithBonus = totalPoints + (todayLeetcodeSolved > 0 ? 20 : 0)
  const earnedWithBonus = earnedPoints + todayLeetcodeBonus
  const scoreToDisplay = totalWithBonus > 0 ? Math.round((earnedWithBonus / totalWithBonus) * 100) : 0

  const quote = todayLog
    ? quotes.find(q => todayLog.score >= q.min)?.text
    : notLoggedQuotes[new Date().getDay() % notLoggedQuotes.length]

  function heatColor(score: number) {
    if (score === 0) return '#1c1c1c'
    if (score >= 90) return '#10b981'
    if (score >= 75) return '#059669'
    if (score >= 60) return '#047857'
    return '#14532d'
  }

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return { date: ds, log: logs.find(l => l.date === ds) }
  })

  const last7 = last30.slice(-7)

  // Gamified Quest Logic: Iron Week (75%+ score for 7 consecutive days)
  const getIronWeekProgress = () => {
    const sorted = [...logs].sort((a,b) => b.date.localeCompare(a.date))
    let currentRun = 0
    let checkDate = new Date()
    for (let i = 0; i < 30; i++) {
      const ds = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`
      const logForDay = logs.find(l => l.date === ds)
      
      // If inspecting today and it is not logged yet, continue to count yesterday
      if (ds === today && !logForDay) {
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }
      
      if (logForDay && logForDay.score >= 75) {
        currentRun++
      } else {
        break
      }
      checkDate.setDate(checkDate.getDate() - 1)
    }
    return Math.min(currentRun, 7)
  }

  // Gamified Quest Logic: Polymath (Log habits in 5+ distinct categories)
  const completedTodayHabits = habits.filter(h => activeCompletedIds.includes(h.id))
  const completedCategories = new Set(completedTodayHabits.map(h => h.category.toUpperCase()))
  const polymathProgress = completedCategories.size

  // Habit Leak Detector Analytics
  const leakDiagnostic = (() => {
    if (logs.length < 3 || habits.length === 0) return null
    const rates = habits.map(h => {
      const total = logs.length
      const done = logs.filter(l => l.completed_habit_ids?.includes(h.id)).length
      return { name: h.name, rate: Math.round((done / total) * 100), points: h.points }
    })
    rates.sort((a,b) => a.rate - b.rate)
    const weakest = rates[0]
    if (weakest && weakest.rate < 60) {
      return {
        name: weakest.name,
        rate: weakest.rate,
        impact: Math.round(weakest.points * (1 - weakest.rate / 100))
      }
    }
    return null
  })()

  const insights = [
    (() => {
      const w = logs.filter(l => l.sleep_time)
      const early = w.filter(l => parseInt(l.sleep_time!.split(':')[0]) < 23)
      const late  = w.filter(l => parseInt(l.sleep_time!.split(':')[0]) >= 23)
      if (!early.length || !late.length) return null
      const diff = Math.round(early.reduce((s,l) => s+l.score,0)/early.length - late.reduce((s,l) => s+l.score,0)/late.length)
      return diff > 0 ? `Sleeping before 11 PM boosts your score by ${diff}%.` : null
    })(),
    (() => {
      const w = logs.filter(l => l.study_hours)
      if (w.length < 3) return null
      const high = w.filter(l => (l.study_hours||0) >= 4)
      const low  = w.filter(l => (l.study_hours||0) <  4)
      if (!high.length || !low.length) return null
      const diff = Math.round(high.reduce((s,l) => s+l.score,0)/high.length - low.reduce((s,l) => s+l.score,0)/low.length)
      return diff > 0 ? `4+ study hours correlates with ${diff}% higher scores.` : null
    })(),
    (() => {
      if (logs.length < 7) return null
      const byDay: Record<number, number[]> = {}
      logs.forEach(l => { const d = new Date(l.date).getDay(); if (!byDay[d]) byDay[d]=[]; byDay[d].push(l.score) })
      const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      let weakest = { day: -1, avg: 101 }
      Object.entries(byDay).forEach(([d, scores]) => {
        const avg = scores.reduce((s,n) => s+n,0)/scores.length
        if (avg < weakest.avg) weakest = { day: +d, avg: Math.round(avg) }
      })
      return weakest.day >= 0 ? `${names[weakest.day]}s are your weakest — avg ${weakest.avg}%.` : null
    })(),
  ].filter(Boolean)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="text-neutral-100 space-y-4 font-sans">
      <div>

        {/* Header */}
        <FadeIn className="flex items-end justify-between pb-2">
          <div>
            <p className="text-xs text-neutral-550 font-mono tracking-wider uppercase">{greeting},</p>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">{userName}</h1>
          </div>
          <p className="text-xs text-neutral-500 font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </FadeIn>

        {/* Row 1 — Today Checklist + Streak + Quick stats */}
        <FadeInStagger className="grid grid-cols-4 gap-3 mb-4">

          {/* Today card — spans 2 with internal 2-column checklist HUD */}
          <StaggerItem className="col-span-2">
            <div className={`premium-card backdrop-blur-lg border shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5 h-full relative overflow-hidden ${
              forecastMode 
                ? 'bg-amber-950/5 border-amber-500/20 shadow-[inset_0_1px_1px_rgba(245,158,11,0.04)]' 
                : 'bg-neutral-950/30 border-neutral-900/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.015)]'
            }`}>
              
              {/* Soft background glow matching current score tier */}
              <div className={`absolute -left-16 -top-16 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500 ${
                forecastMode ? 'bg-amber-500' :
                scoreToDisplay >= 80 ? 'bg-emerald-500' :
                scoreToDisplay >= 60 ? 'bg-amber-500' : 'bg-rose-500'
              }`} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full relative z-10">
                
                {/* Left Side: Score & Core HUD Metrics */}
                <div className="flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Today</p>
                      
                      {/* Forecast Mode Switch */}
                      <button 
                        onClick={toggleForecast}
                        className={`text-[8px] font-mono uppercase px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                          forecastMode 
                            ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
                            : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300'
                        }`}
                      >
                        {forecastMode ? "exit simulator" : "forecast mode"}
                      </button>
                    </div>

                    <div className="flex items-baseline gap-2.5 mb-2">
                      <span className={`text-4xl font-extrabold tracking-tight font-mono transition-all duration-300 ${
                        forecastMode ? 'text-amber-450 drop-shadow-[0_0_10px_rgba(245,158,11,0.35)]' :
                        scoreToDisplay >= 80 ? 'text-emerald-450 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                        scoreToDisplay >= 60 ? 'text-amber-450 drop-shadow-[0_0_10px_rgba(245,158,11,0.25)]' :
                        'text-rose-450 drop-shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                      }`}>{scoreToDisplay}%</span>
                      
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wide transition-all ${
                        forecastMode ? 'bg-amber-950/60 text-amber-450 border border-amber-900/30' :
                        scoreToDisplay >= 80 ? 'bg-emerald-950/60 text-emerald-450 border border-emerald-900/30' :
                        scoreToDisplay >= 60 ? 'bg-amber-950/60 text-amber-450 border border-amber-900/30' :
                        'bg-rose-950/60 text-rose-400 border border-rose-900/30'
                      }`}>
                        {forecastMode ? 'forecast' : scoreToDisplay >= 80 ? 'strong' : scoreToDisplay >= 60 ? 'decent' : 'low'}
                      </span>
                    </div>

                    <div className="w-full bg-neutral-950 border border-neutral-900/60 h-2 rounded-full mb-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${scoreToDisplay}%` }}
                        transition={{ duration: 0.4 }}
                        className={`h-full rounded-full ${
                          forecastMode ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                          scoreToDisplay >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                          scoreToDisplay >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                          'bg-gradient-to-r from-rose-600 to-red-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                        }`}
                      />
                    </div>
                    
                    <p className="text-xs text-neutral-500 italic mb-3">"{quote}"</p>
                  </div>
                  <div>
                    {forecastMode ? (
                      <p className="text-[10px] text-amber-500/80 font-mono uppercase tracking-wider flex items-center gap-1.5 animate-pulse select-none">
                        ⚠️ Simulated Cockpit mode active.
                      </p>
                    ) : !todayLog ? (
                      <motion.button
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                        onClick={() => router.push('/journal')}
                        className="w-full bg-white text-black text-xs font-extrabold py-2.5 rounded-xl hover:bg-neutral-100 transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.08)] hover:shadow-[0_0_16px_rgba(255,255,255,0.18)] cursor-pointer uppercase tracking-wider font-mono text-center"
                      >Start check-in →</motion.button>
                    ) : (
                      <button onClick={() => router.push('/journal')}
                        className="text-xs text-neutral-550 hover:text-white transition-colors font-mono cursor-pointer">
                        edit full log →
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Side: Quick Toggles / Checklist HUD */}
                <div className="flex flex-col justify-between h-full border-l border-neutral-800/40 pl-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">
                        {forecastMode ? "[ SIMULATED CHECKLIST ]" : "[ TODAY'S CHECKLIST ]"}
                      </p>
                      {savingChecklist && (
                        <span className="text-[9px] text-emerald-450 font-mono animate-pulse">
                          SAVING...
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                      {habits.map((habit) => {
                        const isCompleted = forecastMode 
                          ? forecastCompletedIds.includes(habit.id)
                          : todayCompletedIds.includes(habit.id)
                        
                        return (
                          <div 
                            key={habit.id}
                            onClick={() => toggleTodayHabit(habit.id)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer select-none ${
                              isCompleted 
                                ? 'bg-emerald-950/15 border-emerald-500/25 text-white' 
                                : 'bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:border-neutral-800 hover:text-neutral-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                                isCompleted 
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-450 shadow-[0_0_6px_rgba(16,185,129,0.25)]' 
                                  : 'border-neutral-800 bg-transparent'
                              }`}>
                                {isCompleted && (
                                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4.2l2.3 2.3L9 1.5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-xs font-mono truncate max-w-[100px]">{habit.name}</span>
                            </div>
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-mono bg-neutral-900 border border-neutral-850 uppercase text-neutral-500">
                              {habit.points} pts
                            </span>
                          </div>
                        )
                      })}
                      {habits.length === 0 && (
                        <div className="text-center py-6">
                          <p className="text-[10px] text-neutral-600 font-mono">No habits set up yet.</p>
                          <button 
                            onClick={() => router.push('/habits')} 
                            className="text-[9px] text-neutral-500 hover:text-white underline mt-1 font-mono"
                          >
                            Configure habits
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-2 border-t border-neutral-950/45 flex items-center justify-between">
                    {forecastMode ? (
                      <button 
                        onClick={applyForecast}
                        className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 text-[10px] font-bold font-mono py-2 rounded-lg hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all cursor-pointer uppercase tracking-wider text-center"
                      >
                        Apply Forecast to Today →
                      </button>
                    ) : (
                      <button 
                        onClick={() => router.push('/journal')}
                        className="text-[10px] text-neutral-500 hover:text-white transition-colors font-mono cursor-pointer flex items-center gap-1"
                      >
                        open check-in console →
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </StaggerItem>

          {/* Streak Card */}
          <StaggerItem>
            <div className="premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5 h-full flex flex-col justify-between relative overflow-hidden">
              
              {/* Ignition furnace orange glow inside streaking core */}
              {streak > 0 && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.06),transparent_60%)] pointer-events-none select-none" />
              )}
              
              <div className="flex items-center justify-between z-10">
                <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Streak</p>
                {streak > 0 && (
                  <span className="text-xs animate-pulse">🔥</span>
                )}
              </div>
              
              <div className="z-10">
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-extrabold text-white tracking-tight font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.08)]">{streak}</span>
                  <span className="text-neutral-550 text-xs font-mono uppercase tracking-wider">days</span>
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-wider font-mono mt-2 ${streak >= 7 ? 'text-emerald-450 drop-shadow-[0_0_6px_rgba(16,185,129,0.2)]' : 'text-neutral-550'}`}>
                  {streak >= 14 ? '🔥 unstoppable' : streak >= 7 ? '🔥 on fire' : streak > 0 ? 'keep going' : 'start today'}
                </p>
              </div>
            </div>
          </StaggerItem>

          {/* Avg + consistency stacked */}
          <StaggerItem>
            <div className="flex flex-col gap-3 h-full">
              <div className="premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-xl p-4 flex-1">
                <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest mb-1">Avg score</p>
                <p className="text-2xl font-extrabold text-white tracking-tight font-mono drop-shadow-[0_0_6px_rgba(255,255,255,0.08)]">{avgScore}%</p>
              </div>
              <div className="premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-xl p-4 flex-1">
                <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest mb-1">Consistency</p>
                <p className="text-2xl font-extrabold text-white tracking-tight font-mono drop-shadow-[0_0_6px_rgba(255,255,255,0.08)]">{consistency}%</p>
              </div>
            </div>
          </StaggerItem>

        </FadeInStagger>

        {/* Row 2 — Heatmap + Bar chart */}
        <FadeIn delay={0.15} className="grid grid-cols-5 gap-3 mb-4">

          {/* Heatmap — 3 cols */}
          <div className="col-span-3 premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">30-day consistency</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-700 font-mono uppercase">less</span>
                  {['#1c1c1c','#14532d','#047857','#059669','#10b981'].map(c => (
                    <div key={c} className="shadow-[0_0_4px_rgba(0,0,0,0.3)]" style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                  ))}
                  <span className="text-[10px] text-neutral-700 font-mono uppercase">more</span>
                </div>
              </div>
              {/* Fixed square heatmap cells */}
              <div className="relative z-10" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {last30.map(({ date, log }, i) => {
                  const isToday = date === today
                  return (
                    <motion.div
                      key={date}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 + i * 0.01 }}
                      whileHover={{ scale: 1.25, y: -2, zIndex: 20 }}
                      onClick={() => {
                        setSelectedDate(date)
                        setModalOpen(true)
                      }}
                      title={log ? `${date}: ${log.score}% (click to inspect)` : `${date}: Not logged`}
                      className={`cursor-pointer transition-all duration-100 rounded-[4px] border border-transparent ${
                        log && log.score >= 80 ? 'hover:shadow-[0_0_8px_#10b981] hover:border-emerald-400' : 'hover:shadow-[0_0_8px_rgba(255,255,255,0.15)]'
                      }`}
                      style={{
                        width: '24px',
                        height: '24px',
                        background: log ? heatColor(log.score) : '#101012',
                        outline: isToday ? '1.5px solid #10b981' : 'none',
                        outlineOffset: '1.5px',
                        flexShrink: 0,
                      }}
                    />
                  )
                })}
              </div>
            </div>
            
            {/* Fine Dotted milestone progress track */}
            <div className="flex items-center justify-between mt-4 border-t border-neutral-900/60 pt-3 relative">
              <span className="text-[10px] text-neutral-600 font-mono uppercase z-10 bg-[#0a0a0a] pr-2">
                {logs.length === 0 ? 'Day 1 starts today' : `${logs.length} days in`}
              </span>
              
              <div className="absolute left-0 right-0 top-3 h-[1px] border-t border-dashed border-neutral-900 z-0 pointer-events-none" />

              <span className="text-[10px] text-neutral-600 font-mono uppercase z-10 bg-[#0a0a0a] pl-2">
                {logs.length >= 30 ? '30 day milestone reached 🎯' : `${30 - logs.length} days to milestone`}
              </span>
            </div>
          </div>

          {/* Bar chart — 2 cols */}
          <div className="col-span-2 premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Last 7 days</p>
            <div className="flex items-end gap-1.5 h-28 relative">
              
              {/* Fine Telemetry Ruler Lines */}
              <div className="absolute inset-x-0 top-0 bottom-4 flex flex-col justify-between pointer-events-none select-none z-0">
                {[100, 75, 50, 25].map((level) => (
                  <div key={level} className="w-full flex items-center border-t border-neutral-900/60 relative h-0">
                    <span className="absolute -left-6 text-[7px] text-neutral-650 font-mono">
                      {level}
                    </span>
                  </div>
                ))}
              </div>

              {last7.map(({ date, log }) => {
                const isToday = date === today
                const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 z-10">
                    <div className="w-full flex items-end cursor-pointer" style={{ height: '84px' }}
                       onClick={() => {
                         setSelectedDate(date)
                         setModalOpen(true)
                       }}
                    >
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: log ? `${Math.max(log.score, 4)}%` : '3px' }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        whileHover={{ scaleY: 1.05, filter: 'brightness(1.15)' }}
                        style={{
                          width: '100%',
                          borderRadius: '4px 4px 0 0',
                          background: !log ? '#101012'
                            : isToday ? 'linear-gradient(to top, #10b981, #34d399)'
                            : log.score >= 90 ? 'linear-gradient(to top, #047857, #10b981)'
                            : log.score >= 75 ? 'linear-gradient(to top, #065f46, #059669)'
                            : log.score >= 60 ? 'linear-gradient(to top, #0f766e, #047857)'
                            : 'linear-gradient(to top, #14532d, #15803d)',
                          minHeight: '3px',
                          originY: 1,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-600 font-mono uppercase">{dayName}</span>
                    {log && <span className="text-[10px] text-neutral-500 font-mono font-bold">{log.score}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>

        {/* Row 3 — Grid of Insights + Quests/Squad */}
        <FadeIn delay={0.2} className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
          
          {/* Insights (3 cols) */}
          <div className="lg:col-span-3 premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.015)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none select-none z-0" />
            
            <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-600 font-mono select-none">
              [ CODE: SYSTEM DIAGNOSTIC ]
            </div>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Behavioral insights</p>
            
            {/* Display leak alert if found */}
            {leakDiagnostic && (
              <div className="mb-4 bg-rose-950/20 border border-rose-900/45 rounded-xl px-4 py-3 relative overflow-hidden z-10">
                <div className="absolute top-0 right-0 p-2 text-[8px] text-rose-500/55 font-mono select-none uppercase">[ leak detected ]</div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0 animate-pulse shadow-[0_0_6px_#f43f5e]" />
                  <div>
                    <h4 className="text-xs font-semibold text-rose-400 font-mono uppercase tracking-wide">Bottleneck Vector Alert</h4>
                    <p className="text-xs text-rose-350 leading-relaxed font-mono mt-1">
                      Habit <span className="text-rose-100 font-bold font-sans">"{leakDiagnostic.name}"</span> is logged at only <span className="font-bold font-mono">{leakDiagnostic.rate}%</span> consistency. This cost-leak is draining an average of <span className="text-rose-300 font-bold font-mono">-{leakDiagnostic.impact} pts</span> daily score potential. Focus on securing this link tomorrow morning.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {insights.length > 0 ? (
              <div className="space-y-3 relative z-10">
                {insights.map((insight, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0 shadow-[0_0_6px_#10b981]" />
                    <p className="text-[13px] text-neutral-350 leading-relaxed font-mono">{insight}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative z-10">
                <p className="text-xs text-neutral-500 mb-3 font-mono">
                  Log {Math.max(0, 5 - logs.length)} more days to unlock pattern diagnostics.
                </p>
                <div className="flex gap-1.5 mt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < logs.length ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-neutral-950'}`} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quests & Squad Radar (2 cols) */}
          <div className="lg:col-span-2 grid grid-rows-2 gap-3 h-full">
            
            {/* Active Quests */}
            <div className="premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-650 font-mono select-none">[ MISSION QUOTAS ]</div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">Active Quests</p>
              
              <div className="space-y-3">
                {/* Quest 1: Iron Week */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-neutral-300 font-semibold">⚔️ Quest: Iron Week</span>
                    <span className="text-neutral-500">{getIronWeekProgress()}/7 days</span>
                  </div>
                  <div className="w-full bg-neutral-950 border border-neutral-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full shadow-[0_0_4px_#10b981]" style={{ width: `${(getIronWeekProgress() / 7) * 100}%` }} />
                  </div>
                  <p className="text-[9px] text-neutral-650 font-mono mt-0.5 uppercase tracking-wide">Maintain 75%+ score to secure quota</p>
                </div>

                {/* Quest 2: Polymath */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-neutral-300 font-semibold">🧬 Quest: Polymath</span>
                    <span className="text-neutral-500">{polymathProgress}/5 categories</span>
                  </div>
                  <div className="w-full bg-neutral-950 border border-neutral-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full shadow-[0_0_4px_#06b6d4]" style={{ width: `${(polymathProgress / 5) * 100}%` }} />
                  </div>
                  <p className="text-[9px] text-neutral-650 font-mono mt-0.5 uppercase tracking-wide">Log habits in 5+ distinct areas today</p>
                </div>
              </div>
            </div>

            {/* Squad Peer Radar */}
            <div className="premium-card bg-neutral-950/30 backdrop-blur-lg border border-neutral-900/40 shadow-[0_8px_32px_rgba(0,0,0,0.65)] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-650 font-mono select-none">
                {squadInfo ? `[ SQUAD: ${squadInfo.squadName.toUpperCase()} ]` : '[ NO ACTIVE POD ]'}
              </div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-2">Squad Peer Radar</p>
              
              {squadInfo ? (
                <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-1 scrollbar-none">
                  {squadInfo.members.slice(0, 3).map((m, i) => (
                    <div key={m.name} className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg ${
                      m.isSelf ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-transparent border border-transparent'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-600 font-mono">[{i+1}]</span>
                        <span className={`font-mono ${m.isSelf ? 'text-emerald-400 font-semibold' : 'text-neutral-300'}`}>
                          {m.name} {m.isSelf && "(You)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.score !== null ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]" />
                            <span className="font-mono text-neutral-200">{m.score}%</span>
                          </>
                        ) : (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                            <span className="font-mono text-rose-500/70 uppercase text-[9px] font-semibold tracking-wider">OFFLINE</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2 text-center">
                  <p className="text-[10px] text-neutral-600 font-mono">No squadron deployments configured.</p>
                  <button 
                    onClick={() => router.push('/squad')}
                    className="text-[9px] text-neutral-500 hover:text-white underline mt-1 font-mono uppercase tracking-wider"
                  >
                    Go Join a Squad
                  </button>
                </div>
              )}
            </div>

          </div>
        </FadeIn>

        {/* Row 4 — Recent reflections */}
        {logs.filter(l => l.reflection).length > 0 && (
          <FadeIn delay={0.25}>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">Recent reflections</p>
            <div className="space-y-2.5">
              {[...logs].reverse().filter(l => l.reflection).slice(0, 3).map(log => (
                <div key={log.date} className="bg-neutral-950/25 backdrop-blur-md border border-neutral-900/40 hover:border-neutral-800/40 hover:bg-neutral-900/10 rounded-2xl px-5 py-4.5 flex gap-5 items-start hover:shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-all duration-400">
                  <div className="flex-shrink-0 flex flex-col items-start gap-1">
                    <div className="text-xs text-neutral-400 font-mono uppercase tracking-wider font-semibold">[ LOG: {log.date} ]</div>
                    <div className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold uppercase tracking-wide ${
                      log.score >= 80 ? 'bg-emerald-950/60 text-emerald-450 border border-emerald-900/30' :
                      log.score >= 60 ? 'bg-amber-950/60 text-amber-450 border border-amber-900/30' :
                      'bg-rose-950/60 text-rose-450 border border-rose-900/30'
                    }`}>{log.score}% Score</div>
                  </div>
                  <p className="text-sm text-neutral-350 italic leading-relaxed font-sans border-l-2 border-neutral-800 pl-4 py-0.5">"{log.reflection}"</p>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

      </div>

      {/* History Inspection Modal */}
      {selectedDate && (
        <HistoryModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          date={selectedDate}
          log={logs.find(l => l.date === selectedDate)}
          habits={habits}
        />
      )}

    </div>
  )
}
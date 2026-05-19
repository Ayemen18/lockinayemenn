'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import { calculateStreak } from '../lib/streak'
import LeetCodeCard from '../components/LeetCodeCard'

type Log = {
  date: string
  score: number
  earned_points: number
  total_points: number
  study_hours: number | null
  sleep_time: string | null
  reflection: string | null
}

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
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

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
      if (!user) {
        router.push('/login')
        return
      }
      setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')

      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })

      if (data) setLogs(data)
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

  const todayLog = logs.find(l => l.date === today)
  const streak = calculateStreak(logs)
  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length) : 0

  const quote = todayLog
    ? quotes.find(q => todayLog.score >= q.min)?.text
    : notLoggedQuotes[new Date().getDay() % notLoggedQuotes.length]

  function heatColor(score: number) {
    if (score === 0) return '#161616'
    if (score >= 90) return '#22c55e'
    if (score >= 75) return '#4ade80'
    if (score >= 60) return '#86efac'
    return '#3f6212'
  }

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return { date: dateStr, log: logs.find(l => l.date === dateStr) }
  })

  const last7 = last30.slice(-7)

  const sleepInsight = (() => {
    const w = logs.filter(l => l.sleep_time)
    const early = w.filter(l => parseInt(l.sleep_time!.split(':')[0]) < 23)
    const late  = w.filter(l => parseInt(l.sleep_time!.split(':')[0]) >= 23)
    if (!early.length || !late.length) return null
    const diff = Math.round(
      early.reduce((s, l) => s + l.score, 0) / early.length -
      late.reduce((s, l) => s + l.score, 0) / late.length
    )
    return diff > 0 ? `Sleeping before 11 PM boosts your score by ${diff}% on average.` : null
  })()

  const studyInsight = (() => {
    const w = logs.filter(l => l.study_hours)
    if (w.length < 3) return null
    const high = w.filter(l => (l.study_hours || 0) >= 4)
    const low  = w.filter(l => (l.study_hours || 0) <  4)
    if (!high.length || !low.length) return null
    const diff = Math.round(
      high.reduce((s, l) => s + l.score, 0) / high.length -
      low.reduce((s, l) => s + l.score, 0) / low.length
    )
    return diff > 0 ? `4+ study hours correlates with ${diff}% higher scores.` : null
  })()

  const weakDay = (() => {
    if (logs.length < 7) return null
    const byDay: Record<number, number[]> = {}
    logs.forEach(l => {
      const day = new Date(l.date).getDay()
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(l.score)
    })
    const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    let weakest = { day: -1, avg: 101 }
    Object.entries(byDay).forEach(([d, scores]) => {
      const avg = scores.reduce((s, n) => s + n, 0) / scores.length
      if (avg < weakest.avg) weakest = { day: +d, avg: Math.round(avg) }
    })
    return weakest.day >= 0 ? `${names[weakest.day]}s are your weakest — avg ${weakest.avg}%.` : null
  })()

  const insights = [sleepInsight, studyInsight, weakDay].filter(Boolean)
  const recentReflections = [...logs].reverse().filter(l => l.reflection).slice(0, 3)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="text-neutral-100 font-sans">
      <div>

        {/* Header */}
        <FadeIn className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm text-neutral-600 font-mono">{greeting},</p>
            <h1 className="text-2xl font-semibold text-white tracking-tight mt-0.5">{userName}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600 font-mono">
            <span>{logs.length} days logged</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
        </FadeIn>

        {/* Top row — today + streak */}
        <FadeInStagger className="grid grid-cols-3 gap-4 mb-4">
          <StaggerItem className="col-span-2">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 h-full flex flex-col justify-between">
              <div>
                <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-3">Today</p>
                {!todayLog ? (
                  <div>
                    <p className="text-red-400 text-sm font-medium mb-1">Not logged yet</p>
                    <p className="text-neutral-600 text-xs italic mb-4">"{quote}"</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-4xl font-bold text-white tracking-tight">{todayLog.score}%</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        todayLog.score >= 80 ? 'bg-green-950 text-green-400' :
                        todayLog.score >= 60 ? 'bg-yellow-950 text-yellow-400' :
                        'bg-red-950 text-red-400'
                      }`}>
                        {todayLog.score >= 80 ? 'strong' : todayLog.score >= 60 ? 'decent' : 'low'}
                      </span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-0.5 mb-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${todayLog.score}%` }}
                        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
                        className="h-full bg-green-500 rounded-full"
                      />
                    </div>
                    <p className="text-neutral-600 text-xs italic mb-3">"{quote}"</p>
                  </div>
                )}
              </div>
              <div>
                {!todayLog ? (
                  <motion.button
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => router.push('/journal')}
                    className="w-full bg-white text-black text-sm font-semibold py-2.5 rounded-xl hover:bg-neutral-100 transition-colors"
                  >
                    Start today's check-in →
                  </motion.button>
                ) : (
                  <button
                    onClick={() => router.push('/journal')}
                    className="text-xs text-neutral-500 hover:text-white transition-colors font-mono"
                  >
                    Edit today's log →
                  </button>
                )}
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 h-full">
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-3">Streak</p>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-4xl font-bold text-white tracking-tight">{streak}</span>
                <span className="text-neutral-600 text-sm">days</span>
              </div>
              <p className={`text-xs font-mono ${streak >= 7 ? 'text-green-500' : 'text-neutral-700'}`}>
                {streak >= 14 ? '🔥 unstoppable' : streak >= 7 ? '🔥 on fire' : streak > 0 ? 'keep going' : 'start today'}
              </p>
            </div>
          </StaggerItem>
        </FadeInStagger>

        {/* Stats row */}
        <FadeInStagger className="grid grid-cols-4 gap-3 mb-4">
          {[
            { val: `${avgScore}%`,  lbl: 'Avg score' },
            { val: logs.length,     lbl: 'Days logged' },
            { val: logs.filter(l => l.score >= 80).length, lbl: 'Strong days' },
            { val: Math.max(0, 30 - logs.length), lbl: 'Days to 30' },
          ].map(({ val, lbl }) => (
            <StaggerItem key={lbl}>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="text-xl font-bold text-white tracking-tight">{val}</div>
                <div className="text-xs text-neutral-600 font-mono mt-1">{lbl}</div>
              </div>
            </StaggerItem>
          ))}
        </FadeInStagger>

        {/* Heatmap + 7-day bars side by side */}
        <FadeIn className="grid grid-cols-2 gap-4 mb-4" delay={0.15}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest">30-day consistency</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-neutral-700">less</span>
                {['#1f1f1f','#3f6212','#86efac','#4ade80','#22c55e'].map(c => (
                  <div key={c} style={{ background: c }} className="w-2.5 h-2.5 rounded-sm" />
                ))}
                <span className="text-xs text-neutral-700">more</span>
              </div>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}>
              {last30.map(({ date, log }, i) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.015 }}
                  title={log ? `${date}: ${log.score}%` : date}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '2px',
                    background: log ? heatColor(log.score) : '#1f1f1f',
                    outline: date === today ? '1.5px solid #22c55e' : 'none',
                    outlineOffset: '1.5px',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-4">Last 7 days</p>
            <div className="flex items-end gap-2 h-24">
              {last7.map(({ date, log }) => {
                const isToday = date === today
                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-end justify-center" style={{ height: '72px' }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: log ? `${log.score}%` : '3px' }}
                        transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{
                          width: '100%',
                          borderRadius: '3px 3px 0 0',
                          background: !log ? '#161616'
                            : isToday ? '#22c55e'
                            : log.score >= 90 ? '#16a34a'
                            : log.score >= 75 ? '#4ade80'
                            : log.score >= 60 ? '#86efac'
                            : '#3f6212',
                          minHeight: '3px',
                        }}
                      />
                    </div>
                    <span className="text-xs text-neutral-600">{dayName}</span>
                    {log && <span className="text-xs text-neutral-500">{log.score}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>

        {/* LeetCode Card Integration */}
        <FadeIn delay={0.18} className="mb-4">
          <LeetCodeCard />
        </FadeIn>

        {/* Insights */}
        {insights.length > 0 ? (
          <FadeIn delay={0.2} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-4">
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-4">Behavioral insights</p>
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1 h-1 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-neutral-300 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        ) : logs.length < 5 ? (
          <FadeIn delay={0.2} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-4">
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-2">Behavioral insights</p>
            <p className="text-sm text-neutral-600 mb-3">Log {5 - logs.length} more days to unlock pattern detection.</p>
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-0.5 flex-1 rounded-full ${i < logs.length ? 'bg-green-500' : 'bg-neutral-800'}`} />
              ))}
            </div>
          </FadeIn>
        ) : null}

        {/* Recent reflections */}
        {recentReflections.length > 0 && (
          <FadeIn delay={0.25}>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-3">Recent reflections</p>
            <div className="space-y-2">
              {recentReflections.map(log => (
                <div key={log.date} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-start gap-4">
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-neutral-600 font-mono">{log.date}</div>
                    <div className={`text-xs px-1.5 py-0.5 rounded-full font-mono mt-1 ${
                      log.score >= 80 ? 'bg-green-950 text-green-400' :
                      log.score >= 60 ? 'bg-yellow-950 text-yellow-400' :
                      'bg-red-950 text-red-400'
                    }`}>{log.score}%</div>
                  </div>
                  <p className="text-sm text-neutral-400 italic leading-relaxed">"{log.reflection}"</p>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

      </div>
    </div>
  )
}
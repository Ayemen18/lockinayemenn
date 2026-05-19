'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import HistoryModal from '../components/HistoryModal'
import type { Log } from '../types'
import { calculateStreak } from '../lib/streak'
import LeetCodeCard from '../components/LeetCodeCard'

export default function DashboardPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  const [habits, setHabits] = useState<{ id: string, name: string, category: string, points: number }[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  useEffect(() => {
    let active = true

    async function loadData(userId: string) {
      try {
        const { data } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true })
        if (active && data) setLogs(data)

        const { data: habitsData } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId)
          .order('sort_order')
        if (active && habitsData) setHabits(habitsData)
      } catch (err) {
        console.error("Error loading dashboard data:", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (session?.user) {
        loadData(session.user.id)
      } else {
        const timeout = setTimeout(() => {
          if (active) {
            router.push('/login')
          }
        }, 1200)
        return () => clearTimeout(timeout)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm text-neutral-700 font-mono"
        >
          loading...
        </motion.div>
      </div>
    )
  }

  const avgScore = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length) : 0

  const streak = calculateStreak(logs)

  const toLocalDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dateStr = toLocalDate(d)
    return { date: dateStr, log: logs.find(l => l.date === dateStr) }
  })

  const last7 = last30.slice(-7)

  function heatColor(score: number) {
    if (score === 0) return '#161616'
    if (score >= 90) return '#22c55e'
    if (score >= 75) return '#4ade80'
    if (score >= 60) return '#86efac'
    return '#3f6212'
  }

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
    const w = logs.filter(l => l.study_hours !== null && l.study_hours !== undefined)
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans">
      <main className="flex-1 max-w-3xl w-full mx-auto px-8 py-10">

        {/* Dashboard Title block */}
        <FadeIn className="mb-8 border-b border-neutral-900 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-white">Analytics</h1>
          <p className="text-xs text-neutral-500 font-mono mt-1">Advanced behavioral intelligence and trend matrix</p>
        </FadeIn>

        {/* Stats Grid */}
        <FadeInStagger className="grid grid-cols-4 gap-3 mb-6">
          {[
            { val: `${avgScore}%`,  lbl: 'Avg score' },
            { val: streak,          lbl: 'Current streak' },
            { val: logs.length,     lbl: 'Days logged' },
            { val: logs.filter(l => l.score >= 80).length, lbl: 'Strong days' },
          ].map(({ val, lbl }) => (
            <StaggerItem key={lbl}>
              <motion.div
                initial={{ borderColor: 'rgba(38, 38, 38, 0.8)' }}
                whileHover={{
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(255, 255, 255, 0.01)',
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ borderStyle: 'solid', borderWidth: '1px' }}
                className="bg-neutral-900 rounded-2xl p-4 transition-colors"
              >
                <div className="text-2xl font-bold text-white tracking-tight">{val}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mt-1.5">{lbl}</div>
              </motion.div>
            </StaggerItem>
          ))}
        </FadeInStagger>

        {/* Heatmap Section */}
        <FadeIn delay={0.15} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">30-day consistency</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">Less</span>
              {['#1a1a1a','#166534','#bbf7d0','#4ade80','#22c55e'].map(c => (
                <div key={c} style={{ background: c }} className="w-3 h-3 rounded border border-neutral-950" />
              ))}
              <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">More</span>
            </div>
          </div>
          
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}>
            {last30.map(({ date, log }) => (
              <motion.div
                key={date}
                title={log ? `${date}: ${log.score}% (Click to view)` : `${date} (Click to view)`}
                whileHover={{
                  scale: 1.25,
                  zIndex: 10,
                  outline: date === today ? '1.5px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.2)',
                  outlineOffset: '1.5px',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedDate(date)
                  setModalOpen(true)
                }}
                style={{
                  aspectRatio: '1',
                  borderRadius: '2px',
                  background: log ? heatColor(log.score) : '#1f1f1f',
                  outline: date === today ? '1.5px solid #22c55e' : 'none',
                  outlineOffset: '1.5px',
                  transition: 'background 0.3s ease, outline-color 0.2s ease',
                }}
              />
            ))}
          </div>
        </FadeIn>

        {/* Bar Chart Section */}
        <FadeIn delay={0.2} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 mb-6">
          <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-5">Last 7 days</p>
          
          <div className="flex items-end gap-4 h-28 px-2">
            {last7.map(({ date, log }) => {
              const isToday = date === today
              const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: log ? `${log.score}%` : '3px' }}
                      transition={{ type: "spring", stiffness: 80, damping: 15 }}
                      style={{
                        width: '100%',
                        background: !log ? '#161616'
                          : isToday ? '#22c55e'
                          : log.score >= 90 ? '#16a34a'
                          : log.score >= 75 ? '#4ade80'
                          : log.score >= 60 ? '#bbf7d0'
                          : '#166534',
                        borderRadius: '3px 3px 0 0',
                        minHeight: '3px',
                        border: !log ? '1px solid #1f1f1f' : 'none',
                        boxShadow: isToday ? '0 0 12px rgba(34, 197, 94, 0.4)' : 'none',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-neutral-600 font-mono">{dayName}</span>
                  {log ? (
                    <span className="text-[10px] text-neutral-400 font-mono font-medium">{log.score}%</span>
                  ) : (
                    <span className="text-[10px] text-neutral-800 font-mono">—</span>
                  )}
                </div>
              )
            })}
          </div>
        </FadeIn>

        {/* Insights Section */}
        {insights.length > 0 && (
          <FadeIn delay={0.25} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 mb-6">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Behavioral insights</p>
            <div className="space-y-3.5">
              {insights.map((insight, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <p className="text-sm text-neutral-300 leading-relaxed font-sans">{insight}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {insights.length === 0 && logs.length < 5 && (
          <FadeIn delay={0.25} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 mb-6">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-2.5">Behavioral insights</p>
            <p className="text-sm text-neutral-500 font-sans">Log at least 5 days to unlock behavioral insights.</p>
            <div className="flex gap-1 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 flex-1 rounded-full ${
                    i < logs.length 
                      ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' 
                      : 'bg-neutral-850'
                  }`} 
                />
              ))}
            </div>
          </FadeIn>
        )}

        {/* LeetCode integration */}
        <FadeIn delay={0.28} className="mb-6">
          <LeetCodeCard />
        </FadeIn>

        {/* Reflections Section */}
        <FadeIn delay={0.3} className="space-y-3">
          <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Recent reflections</p>
          
          {logs.filter(l => l.reflection).slice(-3).reverse().map((log, index) => (
            <motion.div
              key={log.date}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-neutral-600 font-mono">{log.date}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium tracking-wide uppercase ${
                  log.score >= 80 ? 'bg-green-950 text-green-400 border border-green-900/30' :
                  log.score >= 60 ? 'bg-yellow-950 text-yellow-400 border border-yellow-900/30' :
                  'bg-red-950 text-red-400 border border-red-900/30'
                }`}>{log.score}%</span>
              </div>
              <p className="text-sm text-neutral-300 italic leading-relaxed">"{log.reflection}"</p>
            </motion.div>
          ))}

          {logs.filter(l => l.reflection).length === 0 && (
            <div className="text-center py-10 bg-neutral-900/10 border border-dashed border-neutral-850 rounded-2xl">
              <p className="text-xs text-neutral-600 font-mono">No reflections recorded yet.</p>
            </div>
          )}
        </FadeIn>

      </main>

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
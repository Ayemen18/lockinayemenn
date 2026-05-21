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
      if (logsData) setLogs(logsData as Log[])

      const { data: habitsData } = await supabase
        .from('habits').select('*')
        .eq('user_id', user.id)
      if (habitsData) setHabits(habitsData as Habit[])

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
  const consistency = logs.length > 0
    ? Math.round((logs.filter(l => l.score >= 60).length / logs.length) * 100) : 0

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

        {/* Row 1 — Today + Streak + Quick stats */}
        <FadeInStagger className="grid grid-cols-4 gap-3 mb-4">

          {/* Today card — spans 2 */}
          <StaggerItem className="col-span-2">
            <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 hover:border-neutral-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:shadow-[0_4px_32px_rgba(0,0,0,0.55)] border-t-neutral-850/80 rounded-2xl p-5 h-full flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-neutral-550 font-mono uppercase tracking-widest mb-3">Today</p>
                {!todayLog ? (
                  <>
                    <p className="text-sm text-rose-450 font-semibold mb-1">Not logged yet</p>
                    <p className="text-xs text-neutral-500 italic mb-4">"{quote}"</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2.5 mb-2">
                      <span className={`text-4xl font-extrabold tracking-tight font-mono ${
                        todayLog.score >= 80 ? 'text-emerald-450 drop-shadow-[0_0_8px_rgba(16,185,129,0.25)]' :
                        todayLog.score >= 60 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]' :
                        'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.25)]'
                      }`}>{todayLog.score}%</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wide ${
                        todayLog.score >= 80 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]' :
                        todayLog.score >= 60 ? 'bg-amber-950/60 text-amber-400 border border-amber-900/30 shadow-[0_0_8px_rgba(245,158,11,0.1)]' :
                        'bg-rose-950/60 text-rose-400 border border-rose-900/30 shadow-[0_0_8px_rgba(244,63,94,0.1)]'
                      }`}>{todayLog.score >= 80 ? 'strong' : todayLog.score >= 60 ? 'decent' : 'low'}</span>
                    </div>
                    <div className="w-full bg-neutral-950 border border-neutral-900/60 h-2 rounded-full mb-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${todayLog.score}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className={`h-full rounded-full ${
                          todayLog.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                          todayLog.score >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                          'bg-gradient-to-r from-rose-600 to-red-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                        }`}
                      />
                    </div>
                    <p className="text-xs text-neutral-500 italic mb-3">"{quote}"</p>
                  </>
                )}
              </div>
              <div>
                {!todayLog ? (
                  <motion.button
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => router.push('/journal')}
                    className="w-full bg-white text-black text-xs font-extrabold py-2.5 rounded-xl hover:bg-neutral-100 transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.08)] hover:shadow-[0_0_16px_rgba(255,255,255,0.18)] cursor-pointer uppercase tracking-wider font-mono"
                  >Start check-in →</motion.button>
                ) : (
                  <button onClick={() => router.push('/journal')}
                    className="text-xs text-neutral-550 hover:text-white transition-colors font-mono cursor-pointer">
                    edit today →
                  </button>
                )}
              </div>
            </div>
          </StaggerItem>

          {/* Streak */}
          <StaggerItem>
            <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 hover:border-neutral-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:shadow-[0_4px_32px_rgba(0,0,0,0.55)] border-t-neutral-850/80 rounded-2xl p-5 h-full flex flex-col justify-between">
              <p className="text-[10px] text-neutral-555 font-mono uppercase tracking-widest">Streak</p>
              <div>
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
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 hover:border-neutral-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:shadow-[0_4px_32px_rgba(0,0,0,0.55)] border-t-neutral-850/80 rounded-xl p-4 flex-1">
                <p className="text-[9px] text-neutral-555 font-mono uppercase tracking-widest mb-1">Avg score</p>
                <p className="text-2xl font-extrabold text-white tracking-tight font-mono drop-shadow-[0_0_6px_rgba(255,255,255,0.08)]">{avgScore}%</p>
              </div>
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 hover:border-neutral-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:shadow-[0_4px_32px_rgba(0,0,0,0.55)] border-t-neutral-850/80 rounded-xl p-4 flex-1">
                <p className="text-[9px] text-neutral-555 font-mono uppercase tracking-widest mb-1">Consistency</p>
                <p className="text-2xl font-extrabold text-white tracking-tight font-mono drop-shadow-[0_0_6px_rgba(255,255,255,0.08)]">{consistency}%</p>
              </div>
            </div>
          </StaggerItem>

        </FadeInStagger>

        {/* Row 2 — Heatmap + Bar chart */}
        <FadeIn delay={0.15} className="grid grid-cols-5 gap-3 mb-4">

          {/* Heatmap — 3 cols */}
          <div className="col-span-3 bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 hover:border-neutral-750/60 rounded-2xl p-5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-300">
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
                {last30.map(({ date, log }, i) => (
                  <motion.div
                    key={date}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 + i * 0.01 }}
                    whileHover={{ scale: 1.2, zIndex: 20 }}
                    onClick={() => {
                      setSelectedDate(date)
                      setModalOpen(true)
                    }}
                    title={log ? `${date}: ${log.score}% (click to inspect)` : `${date}: Not logged`}
                    className="cursor-pointer transition-all duration-100 hover:shadow-[0_0_8px_#10b981]"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: log ? heatColor(log.score) : '#1c1c1c',
                      outline: date === today ? '1.5px solid #10b981' : 'none',
                      outlineOffset: '1.5px',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-3 border-t border-neutral-950/40 pt-2.5">
              <span className="text-[10px] text-neutral-600 font-mono uppercase">
                {logs.length === 0 ? 'Day 1 starts today' : `${logs.length} days in`}
              </span>
              <span className="text-[10px] text-neutral-600 font-mono uppercase">
                {logs.length >= 30 ? '30 day milestone reached 🎯' : `${30 - logs.length} days to milestone`}
              </span>
            </div>
          </div>

          {/* Bar chart — 2 cols */}
          <div className="col-span-2 bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 hover:border-neutral-750/60 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-300">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Last 7 days</p>
            <div className="flex items-end gap-1.5 h-28 relative">
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
                          background: !log ? '#1c1c1c'
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

        {/* Row 3 — Insights (Full Width) */}
        <FadeIn delay={0.2} className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-5 mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-650 font-mono select-none">
            [ CODE: SYSTEM DIAGNOSTIC ]
          </div>
          <p className="text-xs text-neutral-550 font-mono uppercase tracking-widest mb-4">Behavioral insights</p>
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0 shadow-[0_0_6px_#10b981]" />
                  <p className="text-sm text-neutral-300 leading-relaxed font-mono text-[13px]">{insight}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-550 mb-3 font-mono">
                Log {Math.max(0, 5 - logs.length)} more days to unlock pattern diagnostics.
              </p>
              <div className="flex gap-1.5 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < logs.length ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-neutral-950'}`} />
                ))}
              </div>
            </>
          )}
        </FadeIn>

        {/* Row 4 — Recent reflections */}
        {logs.filter(l => l.reflection).length > 0 && (
          <FadeIn delay={0.25}>
            <p className="text-xs text-neutral-555 font-mono uppercase tracking-widest mb-3">Recent reflections</p>
            <div className="space-y-2">
              {[...logs].reverse().filter(l => l.reflection).slice(0, 3).map(log => (
                <div key={log.date} className="bg-neutral-900/25 backdrop-blur-sm border border-neutral-800/60 rounded-xl px-4 py-3 flex gap-4 items-start hover:border-neutral-700/65 transition-colors duration-250">
                  <div className="flex-shrink-0">
                    <div className="text-xs text-neutral-500 font-mono">{log.date}</div>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold mt-1 inline-block ${
                      log.score >= 80 ? 'bg-emerald-950 text-emerald-450 border border-emerald-900/30' :
                      log.score >= 60 ? 'bg-amber-950 text-amber-450 border border-amber-900/30' :
                      'bg-rose-950 text-rose-450 border border-rose-900/30'
                    }`}>{log.score}%</div>
                  </div>
                  <p className="text-sm text-neutral-400 italic leading-relaxed font-serif">"{log.reflection}"</p>
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
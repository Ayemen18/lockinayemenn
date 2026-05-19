'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import HistoryModal from '../components/HistoryModal'
import type { Log } from '../types'
import { calculateStreak } from '../lib/streak'

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

export default function HomePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [todayLog, setTodayLog] = useState<Log | null>(null)
  const [allLogs, setAllLogs] = useState<Log[]>([])
  const [userName, setUserName] = useState('')
  const [streak, setStreak] = useState(0)
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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    let active = true

    async function loadData(userId: string, email: string) {
      try {
        setUserName(email.split('@')[0] || '')

        const { data: logs } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        const { data: habitsData } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId)
          .order('sort_order')
        if (active && habitsData) setHabits(habitsData)

        if (active && logs) {
          setAllLogs(logs)
          const todayEntry = logs.find((l: Log) => l.date === today)
          if (todayEntry) setTodayLog(todayEntry)

          setStreak(calculateStreak(logs))
        }
      } catch (err) {
        console.error("Error loading home page data:", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (session?.user) {
        loadData(session.user.id, session.user.email || '')
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

  const quote = todayLog
    ? quotes.find(q => todayLog.score >= q.min)?.text
    : notLoggedQuotes[new Date().getDay() % notLoggedQuotes.length]

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dateStr = d.toISOString().split('T')[0]
    return { date: dateStr, log: allLogs.find(l => l.date === dateStr) }
  })

  function heatColor(score: number) {
    if (score === 0) return '#161616'
    if (score >= 90) return '#22c55e'
    if (score >= 75) return '#4ade80'
    if (score >= 60) return '#bbf7d0'
    return '#166534'
  }

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans">
      <main className="flex-1 max-w-3xl w-full mx-auto px-8 py-10">

        {/* Local Welcome block */}
        <FadeIn className="mb-8 border-b border-neutral-900 pb-5">
          <p className="text-sm text-neutral-600 font-mono">{greeting},</p>
          <h1 className="text-2xl font-semibold text-white mt-0.5 tracking-tight">{userName.split('@')[0]}</h1>
        </FadeIn>

        {/* Core Stats Stagger */}
        <FadeInStagger className="grid grid-cols-3 gap-4 mb-5">
          <StaggerItem>
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 h-full">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">Streak</p>
              <div className="flex items-baseline gap-1.5">
                <motion.span
                  key={streak}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-5xl font-bold text-white tracking-tight"
                >
                  {streak}
                </motion.span>
                <span className="text-neutral-500 text-xs font-mono">days</span>
              </div>
              <p className={`text-[10px] mt-3 font-mono uppercase tracking-wide font-medium ${streak >= 7 ? 'text-green-500' : 'text-neutral-500'}`}>
                {streak >= 14 ? '🔥 unstoppable' : streak >= 7 ? '🔥 on fire' : streak > 0 ? 'keep going' : 'start today'}
              </p>
            </div>
          </StaggerItem>

          <StaggerItem className="col-span-2">
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 h-full">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">Today</p>
              {!todayLog ? (
                <div>
                  <p className="text-red-400 font-medium mb-1">Not logged yet</p>
                  <p className="text-neutral-500 text-sm italic mb-4">"{quote}"</p>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => router.push('/journal')}
                    className="w-full bg-white text-black text-xs font-semibold py-2.5 rounded-xl hover:bg-neutral-100 transition-colors"
                  >
                    Start check-in →
                  </motion.button>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-3 mb-3">
                    <motion.span
                      key={todayLog.score}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-5xl font-bold text-white tracking-tight"
                    >
                      {todayLog.score}%
                    </motion.span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium tracking-wide uppercase ${
                      todayLog.score >= 80 ? 'bg-green-950 text-green-400 border border-green-900/30' :
                      todayLog.score >= 60 ? 'bg-yellow-950 text-yellow-400 border border-yellow-900/30' :
                      'bg-red-950 text-red-400 border border-red-900/30'
                    }`}>
                      {todayLog.score >= 80 ? 'strong' : todayLog.score >= 60 ? 'decent' : 'low'}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-950 rounded-full h-1 mb-3.5 overflow-hidden border border-neutral-900">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${todayLog.score}%` }}
                      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                      className="h-full bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                    />
                  </div>
                  <p className="text-neutral-500 text-xs italic">"{quote}"</p>
                </div>
              )}
            </div>
          </StaggerItem>
        </FadeInStagger>

        {/* 14-day Tracking Heatmap */}
        <FadeIn delay={0.15} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Last 14 days</p>
            <p className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">{allLogs.length} days logged</p>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }}>
            {last14.map(({ date, log }, i) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.03, duration: 0.2 }}
                className="flex flex-col items-center gap-1.5"
              >
                <motion.div
                  whileHover={{
                    scale: 1.22,
                    zIndex: 10,
                    outline: date === today ? '1.5px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.2)',
                    outlineOffset: '1.5px',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  onClick={() => {
                    setSelectedDate(date)
                    setModalOpen(true)
                  }}
                  style={{
                    aspectRatio: '1',
                    width: '100%',
                    borderRadius: '2px',
                    background: log ? heatColor(log.score) : '#1f1f1f',
                    outline: date === today ? '1.5px solid #22c55e' : 'none',
                    outlineOffset: '1.5px',
                    transition: 'background 0.3s ease, outline-color 0.2s ease',
                  }}
                  title={log ? `${date}: ${log.score}% (Click to view)` : `${date} (Click to view)`}
                  className="cursor-pointer"
                />
                <span className="text-neutral-500 text-[10px] font-mono font-medium uppercase mt-0.5">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Dynamic Aggregations */}
        <FadeInStagger className="grid grid-cols-4 gap-3 mb-8">
          {[
            { val: allLogs.length > 0 ? `${Math.round(allLogs.reduce((s, l) => s + l.score, 0) / allLogs.length)}%` : '—', lbl: 'Avg score' },
            { val: allLogs.filter(l => l.score >= 80).length, lbl: 'Strong days' },
            { val: allLogs.length > 0 ? `${Math.round((allLogs.filter(l => l.score >= 60).length / allLogs.length) * 100)}%` : '—', lbl: 'Consistency' },
            { val: Math.max(0, 30 - allLogs.length), lbl: 'Days to 30' },
          ].map(({ val, lbl }) => (
            <StaggerItem key={lbl}>
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-4">
                <div className="text-xl font-bold text-white tracking-tight">{val}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mt-1">{lbl}</div>
              </div>
            </StaggerItem>
          ))}
        </FadeInStagger>

        {/* High Contrast Footer Link controls */}
        <FadeIn delay={0.3} className="flex justify-between items-center border-t border-neutral-900/60 pt-5">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-neutral-500 hover:text-white transition-colors duration-200 font-mono uppercase tracking-wider"
          >
            full analytics →
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="text-xs text-neutral-600 hover:text-red-400 transition-colors duration-200 font-mono uppercase tracking-wider"
          >
            sign out
          </button>
        </FadeIn>

      </main>

      {selectedDate && (
        <HistoryModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          date={selectedDate}
          log={allLogs.find(l => l.date === selectedDate)}
          habits={habits}
        />
      )}
    </div>
  )
}

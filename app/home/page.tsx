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

    async function loadData(userId: string, name: string) {
      try {
        setUserName(name)

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
        const displayName = session.user.user_metadata?.display_name || session.user.email || ''
        loadData(session.user.id, displayName)
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

  const toLocalDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dateStr = toLocalDate(d)
    return { date: dateStr, log: allLogs.find(l => l.date === dateStr) }
  })

  function heatColor(score: number) {
    if (score === 0) return '#161616'
    if (score >= 90) return '#22c55e'
    if (score >= 75) return '#4ade80'
    if (score >= 60) return '#86efac'
    return '#3f6212'
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
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
    <div className="text-neutral-100 font-sans">
      <div>

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
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold tracking-tight text-white font-mono"
                >
                  {streak}
                </motion.span>
                <span className="text-neutral-500 text-xs font-mono uppercase tracking-wider">days</span>
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
                      {todayLog.score >= 80 ? 'elite' : todayLog.score >= 60 ? 'consistent' : 'imperfect'}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-xs font-mono italic">
                    "{quotes.find(q => todayLog.score >= q.min)?.text}"
                  </p>
                </div>
              )}
            </div>
          </StaggerItem>
        </FadeInStagger>

        {/* 14-day tracking row */}
        <FadeIn delay={0.12} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 mb-5">
          <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">14-day history</p>
          <div className="grid grid-cols-14 gap-1.5">
            {last14.map(({ date, log }) => (
              <motion.div
                key={date}
                title={log ? `${date}: ${log.score}% (Click to view)` : `${date} (Click to view)`}
                whileHover={{ scale: 1.18, zIndex: 10 }}
                onClick={() => { setSelectedDate(date); setModalOpen(true) }}
                className="cursor-pointer"
                style={{
                  aspectRatio: '1',
                  borderRadius: '2px',
                  background: log ? heatColor(log.score) : '#1a1a1a',
                  outline: date === today ? '1.5px solid #22c55e' : 'none',
                  outlineOffset: '1.5px',
                  transition: 'background 0.2s ease',
                }}
              />
            ))}
          </div>
        </FadeIn>

        {/* Action Panel / Quick logs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <FadeIn delay={0.18} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between h-44">
            <div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-2">check-in console</p>
              <h3 className="text-sm text-neutral-400 font-sans leading-relaxed">
                {todayLog
                  ? "Log updated. Excellent progress made today."
                  : "Stand by. Today is unlogged. Execute routine."}
              </h3>
            </div>
            <button
              onClick={() => router.push('/journal')}
              className={`w-full text-xs font-semibold py-2.5 rounded-xl transition-all duration-200 ${
                todayLog
                  ? 'bg-neutral-850 hover:bg-neutral-800 text-neutral-300'
                  : 'bg-white hover:bg-neutral-200 text-black'
              }`}
            >
              {todayLog ? 'Edit Check-In' : 'Start Check-In'}
            </button>
          </FadeIn>

          <FadeIn delay={0.22} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between h-44">
            <div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-2">command focus</p>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed italic">
                "{quote}"
              </p>
            </div>
            <button
              onClick={() => router.push('/insights')}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors duration-200"
            >
              Consult AI Coach
            </button>
          </FadeIn>
        </div>

        {/* Footer shortcuts */}
        <FadeIn delay={0.26} className="flex justify-between items-center pt-3 border-t border-neutral-900">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors duration-200 font-mono uppercase tracking-wider"
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

      </div>

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

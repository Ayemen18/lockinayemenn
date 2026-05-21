'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Journal',   path: '/journal' },
  { name: 'Habits',    path: '/habits' },
  { name: 'AI Coach',  path: '/insights' },
  { name: 'Squad',     path: '/squad' },
]

export default function Navbar() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const pathname = usePathname()

  const [userName, setUserName] = useState('')
  const [todayLogged, setTodayLogged] = useState(false)
  const [todayScore, setTodayScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')
      const { data: log } = await supabase
        .from('daily_logs').select('score')
        .eq('user_id', user.id).eq('date', today).maybeSingle()
      setTodayLogged(!!log)
      if (log) setTodayScore(log.score)
      setLoading(false)
    }
    load()
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-350 ${
      scrolled
        ? 'bg-[#0a0a0a]/65 backdrop-blur-xl border-b border-neutral-900/60 shadow-[0_4px_30px_rgba(0,0,0,0.8)]'
        : 'bg-[#0a0a0a]/40 backdrop-blur-md border-b border-neutral-900/20'
    }`}>
      <div className="w-full max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2.5 flex-shrink-0 group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-center justify-center group-hover:border-neutral-600/80 transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.01)] group-hover:shadow-[0_0_12px_rgba(255,255,255,0.035)]">
            <span className="text-white text-xs font-mono font-bold tracking-tighter">L</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-white group-hover:text-neutral-300 transition-colors">
            LockIn
          </span>
          <span className="relative flex h-2 w-2 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
          </span>
        </button>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 bg-neutral-950/50 border border-neutral-900 px-1 py-1 rounded-xl shadow-inner">
          {navLinks.map(link => {
            const isActive = pathname === link.path
            return (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                className={`relative px-3.5 py-1.5 text-xs font-mono rounded-lg transition-colors duration-150 cursor-pointer ${
                  isActive ? 'text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-neutral-900/90 rounded-lg border border-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.name}</span>
              </button>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {!loading && (
            <>
              {todayLogged ? (
                <motion.button
                  onClick={() => router.push('/journal')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-all duration-300 ${
                    todayScore && todayScore >= 80
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/60 shadow-[0_0_12px_rgba(16,185,129,0.06)]'
                      : todayScore && todayScore >= 60
                      ? 'bg-amber-950/30 border-amber-800/50 text-amber-400 hover:bg-amber-950/60 shadow-[0_0_12px_rgba(245,158,11,0.06)]'
                      : 'bg-rose-950/30 border-rose-800/50 text-rose-400 hover:bg-rose-950/60 shadow-[0_0_12px_rgba(244,63,94,0.06)]'
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
                  </span>
                  {todayScore}% logged
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => router.push('/journal')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 text-xs font-mono px-3.5 py-1.5 rounded-lg bg-white text-black font-extrabold hover:bg-neutral-100 transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.08)] hover:shadow-[0_0_16px_rgba(255,255,255,0.18)] cursor-pointer"
                >
                  Log today
                </motion.button>
              )}

              <div className="flex items-center gap-3 pl-3 border-l border-neutral-900">
                <button
                  onClick={() => router.push('/profile')}
                  title="Profile & Settings"
                  className="w-6.5 h-6.5 rounded-full bg-neutral-900 border border-neutral-800/80 hover:border-neutral-600 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-inner hover:scale-105"
                >
                  <span className="text-[10px] text-neutral-300 font-mono font-extrabold">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </button>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    router.push('/login')
                  }}
                  title="Sign out"
                  className="text-neutral-700 hover:text-rose-500 hover:bg-rose-950/15 transition-all ml-1 p-1 rounded-lg cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  )
}

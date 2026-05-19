'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { name: 'Home',      path: '/home' },
  { name: 'Dashboard', path: '/dashboard' },
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
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      scrolled
        ? 'bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-neutral-800/80'
        : 'bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-800/40'
    }`}>
      <div className="w-full max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-2.5 flex-shrink-0 group"
        >
          <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center group-hover:border-neutral-500 transition-colors">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            LockIn
          </span>
          <span className="relative flex h-1.5 w-1.5 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
          </span>
        </button>

        {/* Nav links */}
        <nav className="flex items-center gap-1 bg-neutral-900/50 border border-neutral-800/60 px-1.5 py-1.5 rounded-xl">
          {navLinks.map(link => {
            const isActive = pathname === link.path
            return (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                className={`relative px-3.5 py-1.5 text-xs font-mono rounded-lg transition-colors duration-150 ${
                  isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-neutral-800 rounded-lg border border-neutral-700/60"
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
                  className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                    todayScore && todayScore >= 80
                      ? 'bg-green-950/60 border-green-900/60 text-green-400 hover:bg-green-950'
                      : todayScore && todayScore >= 60
                      ? 'bg-yellow-950/60 border-yellow-900/60 text-yellow-400 hover:bg-yellow-950'
                      : 'bg-red-950/60 border-red-900/60 text-red-400 hover:bg-red-950'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {todayScore}% today
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => router.push('/journal')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-white text-black font-semibold hover:bg-neutral-100 transition-colors"
                >
                  Log today
                </motion.button>
              )}

              <div className="flex items-center gap-2 pl-3 border-l border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                  <span className="text-xs text-neutral-400 font-mono">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-neutral-500 font-mono hidden lg:block">
                  {userName}
                </span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    router.push('/login')
                  }}
                  className="text-xs text-neutral-700 hover:text-neutral-400 font-mono transition-colors ml-1"
                >
                  out
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  )
}

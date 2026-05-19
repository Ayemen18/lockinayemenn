'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [isHovered, setIsHovered] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function loadStatus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')
        const { data: log } = await supabase
          .from('daily_logs')
          .select('score')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
        setTodayLogged(!!log)
        if (log) setTodayScore(log.score)
      }
      setLoading(false)
    }
    loadStatus()
  }, [])

  const navLinks = [
    { name: 'Home', path: '/home' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Habits', path: '/habits' },
    { name: 'AI Coach', path: '/insights' },
    { name: 'Squad', path: '/squad' },
  ]

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0a0a]/60 backdrop-blur-md border-b border-neutral-900/80">
      <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
        
        {/* Left: Logo */}
        <div 
          onClick={() => router.push('/home')} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded bg-neutral-900 border border-neutral-800 text-white font-semibold shadow-inner group-hover:border-neutral-700 transition-colors">
            ▦
          </div>
          <span className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 font-sans">
            LockIn
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
          </span>
        </div>

        {/* Center: Sliding Nav Links */}
        <nav className="flex items-center gap-1.5 bg-neutral-900/40 p-1 rounded-xl border border-neutral-900">
          {navLinks.map(link => {
            const isActive = pathname === link.path
            return (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                className={`relative px-3.5 py-1.5 text-xs font-mono rounded-lg transition-colors duration-200 outline-none ${
                  isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-neutral-800/80 rounded-lg -z-10 border border-neutral-700/30 shadow-sm"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {link.name}
              </button>
            )
          })}
        </nav>

        {/* Right: Dynamic Actions & User Status */}
        <div className="flex items-center gap-4">
          <div 
            onClick={() => router.push('/profile')}
            className="hidden sm:flex flex-col items-end cursor-pointer group select-none"
          >
            <span className="text-[11px] text-neutral-600 font-mono group-hover:text-neutral-450 transition-colors">USER</span>
            <span className="text-[11px] text-neutral-400 font-mono tracking-tight font-medium max-w-[120px] truncate group-hover:text-white transition-colors">
              {userName || 'loading...'}
            </span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => router.push('/journal')}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-350 shadow-sm select-none min-w-[125px] flex items-center justify-center overflow-hidden relative ${
              loading
                ? 'bg-neutral-800/20 border border-neutral-800/40 text-neutral-500 cursor-not-allowed'
                : todayLogged
                ? todayScore === 0
                  ? 'bg-neutral-900 border border-neutral-850 text-neutral-500 hover:bg-neutral-800/40 shadow-inner'
                  : 'bg-neutral-900 border border-green-900/30 text-green-400 hover:bg-neutral-800/40 shadow-green-950/20 shadow-md'
                : 'bg-white text-black hover:bg-neutral-200 shadow-lg shadow-white/5'
            }`}
            disabled={loading}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={isHovered ? 'hover' : 'idle'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="flex items-center gap-1 font-mono tracking-tight text-[11px] font-medium"
              >
                {loading ? (
                  'loading...'
                ) : todayLogged ? (
                  isHovered ? (
                    <>EDIT CHECK-IN ✎</>
                  ) : (
                    <>✓ LOGGED</>
                  )
                ) : isHovered ? (
                  <>CHECK OFF HABITS →</>
                ) : (
                  <>LOG TODAY</>
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors font-mono uppercase tracking-wider"
          >
            Sign out
          </button>
        </div>

      </div>
    </header>
  )
}

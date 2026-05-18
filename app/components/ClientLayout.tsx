'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const isAuthPage = pathname === '/login' || pathname?.startsWith('/auth/')

  // Global Keyboard Shortcuts Event Handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Safeguard: Ignore shortcuts if typing inside input, textarea, or contenteditable fields
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return
      }

      const key = e.key.toLowerCase()

      if (key === 'h') {
        e.preventDefault()
        router.push('/home')
      } else if (key === 'd') {
        e.preventDefault()
        router.push('/dashboard')
      } else if (key === 'c') {
        e.preventDefault()
        router.push('/journal')
      } else if (key === 's') {
        e.preventDefault()
        router.push('/habits')
      } else if (key === 'p') {
        e.preventDefault()
        router.push('/profile')
      } else if (key === '?') {
        e.preventDefault()
        setShortcutsOpen(prev => !prev)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShortcutsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col select-none">
      
      {/* Permanent, static Navbar preserving Layout Continuity */}
      <Navbar />

      {/* Render children directly for 100% Next.js router compatibility and zero freezes */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Keyboard Shortcuts Cheatsheet Overlay */}
      <AnimatePresence>
        {shortcutsOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShortcutsOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-[3px] cursor-pointer"
            />

            {/* Card modal container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 450, damping: 24 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full relative z-10 shadow-2xl font-sans"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                <div>
                  <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider block mb-0.5">Control Center</span>
                  <h3 className="text-sm font-bold text-white tracking-tight">Keyboard Shortcuts</h3>
                </div>
                <button
                  onClick={() => setShortcutsOpen(false)}
                  className="text-xs text-neutral-500 hover:text-white font-mono"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5">
                {[
                  { key: 'H', desc: 'Navigate to Home Overview' },
                  { key: 'D', desc: 'Navigate to Analytics Dashboard' },
                  { key: 'C', desc: 'Open Daily Check-In Journal' },
                  { key: 'S', desc: 'Configure Habit Point Profiles' },
                  { key: 'P', desc: 'Edit User Settings / Profile' },
                  { key: '?', desc: 'Toggle keyboard shortcuts cheatsheet' },
                  { key: 'Esc', desc: 'Close open overlay modals instantly' },
                ].map(({ key, desc }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-medium">{desc}</span>
                    <kbd className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-[10px] font-mono font-semibold text-neutral-300 shadow-sm">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-800 mt-5 pt-3.5 text-center">
                <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-wider">
                  Press any key to jump pages instantly
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

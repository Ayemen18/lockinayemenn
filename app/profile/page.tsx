'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import LeetCodeCard from '../components/LeetCodeCard'

export default function ProfilePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalDays: 0, avgScore: 0, streak: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('date, score')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (logs) {
        const avg = logs.length > 0
          ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length) : 0
        setStats({ totalDays: logs.length, avgScore: avg, streak: 0 })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveDisplayName() {
    if (!displayName.trim()) return
    setSaving(true)
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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

  return (
    <div className="text-neutral-100 space-y-4 max-w-2xl font-sans mx-auto">

      <FadeIn className="mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Profile</h1>
        <p className="text-sm text-neutral-600 font-mono mt-1">Settings and integrations</p>
      </FadeIn>

      {/* Account */}
      <FadeIn>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-4">Account</p>

          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-neutral-800">
            <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
              <span className="text-lg font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-neutral-600 font-mono">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { val: stats.totalDays, lbl: 'Days logged' },
              { val: `${stats.avgScore}%`, lbl: 'Avg score' },
              { val: stats.streak, lbl: 'Current streak' },
            ].map(({ val, lbl }) => (
              <div key={lbl} className="bg-neutral-800/60 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-white">{val}</div>
                <div className="text-xs text-neutral-600 font-mono mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-neutral-600 font-mono uppercase tracking-widest block mb-2">
              Display name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveDisplayName()}
                className="flex-1 bg-[#0a0a0a] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors font-mono"
              />
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={saveDisplayName}
                disabled={saving}
                className="px-4 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-100 transition-colors disabled:opacity-40"
              >
                {saved ? '✓' : saving ? '...' : 'Save'}
              </motion.button>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* LeetCode */}
      <FadeIn delay={0.1}>
        <LeetCodeCard />
      </FadeIn>

      {/* Danger zone */}
      <FadeIn delay={0.2}>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-4">Session</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="text-sm text-red-400 hover:text-red-300 transition-colors font-mono"
          >
            Sign out
          </button>
        </div>
      </FadeIn>

    </div>
  )
}

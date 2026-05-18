'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'

export default function ProfilePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Fields
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [studyGoal, setStudyGoal] = useState('20')
  const [sleepGoal, setSleepGoal] = useState('8')
  const [targetScore, setTargetScore] = useState('80')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')
      setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')
      setBio(user.user_metadata?.bio || '')
      setStudyGoal(user.user_metadata?.study_goal || '20')
      setSleepGoal(user.user_metadata?.sleep_goal || '8')
      setTargetScore(user.user_metadata?.target_score || '80')
      
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSave() {
    if (!displayName.trim()) return
    setSaving(true)
    setSuccess(false)

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: displayName.trim(),
        bio: bio.trim(),
        study_goal: studyGoal,
        sleep_goal: sleepGoal,
        target_score: targetScore,
      }
    })

    setSaving(false)
    if (!error) {
      setSuccess(true)
      // Force window reload or dispatch a custom event to notify Navbar of name change!
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm text-neutral-700 font-mono"
        >
          loading profile settings...
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans">
      <main className="flex-1 max-w-xl w-full mx-auto px-8 py-10">

        {/* Back button */}
        <FadeIn className="mb-6">
          <button
            onClick={() => router.push('/home')}
            className="text-neutral-600 hover:text-neutral-450 text-xs font-mono transition-colors uppercase tracking-wider"
          >
            ← back to dashboard
          </button>
        </FadeIn>

        {/* Title block */}
        <FadeIn delay={0.05} className="mb-8 border-b border-neutral-900 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-white">Profile Settings</h1>
          <p className="text-xs text-neutral-500 font-mono mt-1">Configure your personal preferences and goal targets</p>
        </FadeIn>

        {/* Success Prompt */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-green-950/40 border border-green-900/30 text-green-400 text-xs font-mono px-4 py-3 rounded-xl mb-6 flex items-center justify-between"
            >
              <span>✓ Settings updated successfully. Changes are now live!</span>
              <button onClick={() => setSuccess(false)} className="text-green-600 hover:text-green-400">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Container */}
        <FadeInStagger className="space-y-6">
          
          {/* Identity Section */}
          <StaggerItem className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 space-y-4">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Identity Info</p>

            <div>
              <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Registered Email</label>
              <input
                type="text"
                value={email}
                disabled
                className="w-full border border-neutral-800/50 rounded-xl px-3.5 py-2 text-sm text-neutral-500 outline-none bg-neutral-950 cursor-not-allowed select-none font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="w-full border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none bg-[#0a0a0a] focus:border-neutral-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Personal Motto / Daily Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="e.g. Consistency is the compound interest of self-improvement."
                rows={2}
                className="w-full border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 outline-none bg-[#0a0a0a] focus:border-neutral-600 transition-colors resize-none placeholder:text-neutral-800"
              />
            </div>
          </StaggerItem>

          {/* Goal Metrics Section */}
          <StaggerItem className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 space-y-4">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Target Goals</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Weekly Study Goal</label>
                <div className="flex items-center gap-2 border border-neutral-800 rounded-xl px-3 bg-[#0a0a0a] focus-within:border-neutral-600 transition-colors">
                  <input
                    type="number"
                    value={studyGoal}
                    onChange={e => setStudyGoal(e.target.value)}
                    className="w-full text-sm text-neutral-200 outline-none py-2 bg-transparent font-mono"
                  />
                  <span className="text-[11px] text-neutral-600 font-mono">hrs</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Daily Sleep Goal</label>
                <div className="flex items-center gap-2 border border-neutral-800 rounded-xl px-3 bg-[#0a0a0a] focus-within:border-neutral-600 transition-colors">
                  <input
                    type="number"
                    value={sleepGoal}
                    onChange={e => setSleepGoal(e.target.value)}
                    className="w-full text-sm text-neutral-200 outline-none py-2 bg-transparent font-mono"
                  />
                  <span className="text-[11px] text-neutral-600 font-mono">hrs</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Target Daily Score</label>
              <div className="flex items-center gap-2 border border-neutral-800 rounded-xl px-3 bg-[#0a0a0a] focus-within:border-neutral-600 transition-colors">
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={targetScore}
                  onChange={e => setTargetScore(e.target.value)}
                  className="w-full text-sm text-neutral-200 outline-none py-2 bg-transparent font-mono"
                />
                <span className="text-[11px] text-neutral-600 font-mono">%</span>
              </div>
            </div>
          </StaggerItem>

          {/* Action button */}
          <StaggerItem>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSave}
              disabled={saving || !displayName.trim()}
              className="w-full bg-white text-black text-xs font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving changes...' : 'Save Settings'}
            </motion.button>
          </StaggerItem>

        </FadeInStagger>

      </main>
    </div>
  )
}

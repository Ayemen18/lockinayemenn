'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion } from 'framer-motion'

type LeetCodeData = {
  username: string
  ranking: number
  streak: number
  totalSolved: number
  easy: number
  medium: number
  hard: number
  todaySolvedCount: number
  todayProblems: string[]
}

export default function LeetCodeCard({ onTodaySolved }: { onTodaySolved?: (count: number) => void }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [username, setUsername] = useState('')
  const [savedUsername, setSavedUsername] = useState('')
  const [data, setData] = useState<LeetCodeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('leetcode_username')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.leetcode_username) {
        setSavedUsername(profile.leetcode_username)
        setUsername(profile.leetcode_username)
        await fetchData(profile.leetcode_username)
      }
    }
    load()
  }, [])

  async function fetchData(uname: string) {
    if (!uname) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/leetcode?username=${encodeURIComponent(uname)}`)
      const json = await res.json()

      if (json.error) {
        setError(json.error === 'User not found' ? 'Username not found on LeetCode.' : 'Failed to fetch. Try again.')
        setLoading(false)
        return
      }

      setData(json)
      setLastSynced(new Date())
      if (onTodaySolved) onTodaySolved(json.todaySolvedCount)
    } catch {
      setError('Network error. Try again.')
    }

    setLoading(false)
  }

  async function saveUsername() {
    if (!username.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('user_profiles').upsert({
      id: user.id,
      leetcode_username: username.trim(),
      updated_at: new Date().toISOString(),
    })

    setSavedUsername(username.trim())
    setEditing(false)
    await fetchData(username.trim())
  }

  if (!savedUsername && !editing) {
    return (
      <div className="bg-neutral-900/70 backdrop-blur-xl border border-neutral-850 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">LeetCode Integration</p>
        </div>
        <p className="text-sm text-neutral-400 mb-4 font-sans leading-relaxed">Connect your profile to automatically check off LeetCode habits on solved counts.</p>
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] font-bold text-neutral-300 hover:text-white px-4 py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 transition-colors uppercase tracking-wider font-mono cursor-pointer"
        >
          Connect LeetCode
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="bg-neutral-900/70 backdrop-blur-xl border border-neutral-850 rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">LeetCode Username</p>
        <input
          autoFocus
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveUsername()}
          placeholder="your-leetcode-username"
          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-750 transition-colors mb-3 font-mono placeholder:text-neutral-800"
        />
        {error && <p className="text-xs text-rose-450 font-mono mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={saveUsername}
            disabled={loading}
            className="flex-1 bg-white text-black text-xs font-bold py-2.5 rounded-xl hover:bg-neutral-100 transition-colors disabled:opacity-40 uppercase tracking-wider cursor-pointer"
          >
            {loading ? 'Connecting...' : 'Save'}
          </button>
          {savedUsername && (
            <button
              onClick={() => { setEditing(false); setUsername(savedUsername) }}
              className="px-4 text-xs font-semibold text-neutral-500 border border-neutral-800 rounded-xl hover:bg-neutral-800 hover:text-neutral-300 transition-colors uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900/50 backdrop-blur-xl border border-cyan-950/30 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] relative overflow-hidden group/lc hover:border-cyan-900/40 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.015)] hover:shadow-[0_0_18px_rgba(6,182,212,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">LeetCode</p>
          {data?.todaySolvedCount ? (
            <span className="text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold shadow-[0_0_8px_rgba(16,185,129,0.1)]">
              +{data.todaySolvedCount} today
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          {lastSynced && (
            <span className="text-[9px] text-neutral-600 font-mono">
              SYNCED: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchData(savedUsername)}
            disabled={loading}
            className="text-[9px] text-neutral-500 hover:text-white transition-colors font-mono uppercase tracking-wider disabled:opacity-40 border border-neutral-800 px-2 py-1 rounded-md bg-neutral-900/40 cursor-pointer"
          >
            {loading ? '...' : '↻ sync'}
          </motion.button>
          <button
            onClick={() => setEditing(true)}
            className="text-[9px] text-neutral-600 hover:text-neutral-450 transition-colors font-mono uppercase tracking-wider cursor-pointer"
          >
            edit
          </button>
        </div>
      </div>

      {loading && !data ? (
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-xs text-neutral-600 font-mono py-4"
        >
          Fetching LeetCode status...
        </motion.div>
      ) : error ? (
        <p className="text-xs text-rose-400 font-mono">{error}</p>
      ) : data ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-bold text-white tracking-tight">{data.username}</span>
            <span className="text-[10px] text-neutral-500 font-mono">Rank #{data.ranking?.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-neutral-950/70 border border-neutral-900 rounded-xl p-3 text-center shadow-inner">
              <div className="text-lg font-bold text-white font-mono">{data.streak}</div>
              <div className="text-[9px] text-neutral-600 font-mono uppercase tracking-wider mt-0.5">streak</div>
            </div>
            <div className="bg-neutral-950/70 border border-neutral-900 rounded-xl p-3 text-center shadow-inner">
              <div className="text-lg font-bold text-white font-mono">{data.totalSolved}</div>
              <div className="text-[9px] text-neutral-600 font-mono uppercase tracking-wider mt-0.5">solved</div>
            </div>
            <div className="bg-neutral-950/70 border border-neutral-900 rounded-xl p-3 text-center shadow-inner">
              <div className={`text-lg font-bold font-mono ${data.todaySolvedCount > 0 ? 'text-emerald-450 drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]' : 'text-neutral-650'}`}>
                {data.todaySolvedCount}
              </div>
              <div className="text-[9px] text-neutral-600 font-mono uppercase tracking-wider mt-0.5">today</div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {[
              { label: 'Easy', val: data.easy, color: 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 shadow-[0_0_8px_rgba(16,185,129,0.05)]' },
              { label: 'Medium', val: data.medium, color: 'text-amber-400 bg-amber-950/20 border border-amber-900/30 shadow-[0_0_8px_rgba(245,158,11,0.05)]' },
              { label: 'Hard', val: data.hard, color: 'text-rose-400 bg-rose-950/20 border border-rose-900/30 shadow-[0_0_8px_rgba(244,63,94,0.05)]' },
            ].map(({ label, val, color }) => (
              <div key={label} className={`flex-1 ${color} rounded-xl px-2 py-2 text-center`}>
                <div className="text-sm font-bold font-mono">{val}</div>
                <div className="text-[8px] font-bold font-mono uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {data.todayProblems.length > 0 && (
            <div className="bg-neutral-950/60 border border-neutral-900 rounded-xl p-3 shadow-inner">
              <p className="text-[9px] text-neutral-550 font-mono uppercase tracking-wider mb-2">[ TERMINAL LOG: TODAY'S PROBLEMS ]</p>
              <div className="space-y-2">
                {data.todayProblems.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-emerald-500 font-mono select-none flex-shrink-0">&gt;</span>
                    <p className="text-neutral-450 font-mono leading-normal break-all">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

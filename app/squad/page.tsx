'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'
import { calculateStreak } from '../lib/streak'

type MemberStats = {
  user_id: string
  display_name: string
  todayScore: number | null
  todayLogged: boolean
  streak: number
  weekAvg: number
  studyHours: number | null
  consistency: number
  allTimeAvg: number
  leetcodeSolvedToday: number
  leetcodeTotalSolved: number | null
  leetcodeStreak: number
}

type Squad = {
  id: string
  name: string
  code: string
  created_by: string
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function SquadContent() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<any>(null)
  const [squads, setSquads] = useState<Squad[]>([])
  const [activeSquad, setActiveSquad] = useState<Squad | null>(null)
  const [memberStats, setMemberStats] = useState<MemberStats[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  const [view, setView] = useState<'daily' | 'weekly' | 'leetcode'>('daily')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [squadName, setSquadName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  // Get Monday of current week
  const weekStart = (() => {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return new Date(d.getTime() - offset * 60 * 1000).toISOString().split('T')[0]
  })()

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      if (active) {
        setUser(authUser)
        setDisplayName(authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || '')
      }

      // Check for invite code in URL
      const inviteCode = searchParams.get('code')
      if (inviteCode && active) {
        setJoinCode(inviteCode)
        setShowJoin(true)
      }

      await loadSquads(authUser.id, active)
      if (active) setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [searchParams])

  async function loadSquads(userId: string, active: boolean) {
    const { data: memberRows } = await supabase
      .from('squad_members')
      .select('squad_id')
      .eq('user_id', userId)

    if (!memberRows?.length) return

    const squadIds = memberRows.map(r => r.squad_id)
    const { data: squadData } = await supabase
      .from('squads')
      .select('*')
      .in('id', squadIds)

    if (squadData && active) {
      setSquads(squadData)
      if (squadData.length > 0) {
        setActiveSquad(squadData[0])
        await loadMemberStats(squadData[0].id, userId, active)
      }
    }
  }

  async function loadMemberStats(squadId: string, currentUserId: string, active: boolean) {
    if (active) setStatsLoading(true)

    const { data: members } = await supabase
      .from('squad_members')
      .select('user_id, display_name')
      .eq('squad_id', squadId)

    if (!members) {
      if (active) setStatsLoading(false)
      return
    }

    // Fetch user profiles to get leetcode_usernames
    const userIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, leetcode_username')
      .in('id', userIds)

    const stats: MemberStats[] = await Promise.all(
      members.map(async (member) => {
        const { data: logs } = await supabase
          .from('daily_logs')
          .select('date, score, study_hours, leetcode_solved')
          .eq('user_id', member.user_id)
          .order('date', { ascending: false })
          .limit(30)

        const todayLog = logs?.find(l => l.date === today)
        const weekLogs = logs?.filter(l => l.date >= weekStart) || []
        const allLogs = logs || []

        const streak = calculateStreak(allLogs)

        const weekAvg = weekLogs.length > 0
          ? Math.round(weekLogs.reduce((s, l) => s + l.score, 0) / weekLogs.length)
          : 0

        const allTimeAvg = allLogs.length > 0
          ? Math.round(allLogs.reduce((s, l) => s + l.score, 0) / allLogs.length)
          : 0

        const consistency = allLogs.length > 0
          ? Math.round((allLogs.filter(l => l.score >= 60).length / allLogs.length) * 100)
          : 0

        const recentStudy = logs?.filter(l => l.study_hours).slice(0, 7)
        const avgStudy = recentStudy?.length
          ? recentStudy.reduce((s, l) => s + (l.study_hours || 0), 0) / recentStudy.length
          : null

        // Fetch LeetCode username
        const memberProfile = profiles?.find(p => p.id === member.user_id)
        const username = memberProfile?.leetcode_username

        let leetcodeSolvedToday = todayLog?.leetcode_solved || 0
        let leetcodeTotalSolved: number | null = null
        let leetcodeStreak = 0

        if (username) {
          try {
            const res = await fetch(`/api/leetcode?username=${encodeURIComponent(username)}`)
            const json = await res.json()
            if (json && !json.error) {
              leetcodeSolvedToday = json.todaySolvedCount || 0
              leetcodeTotalSolved = json.totalSolved || null
              leetcodeStreak = json.streak || 0
            }
          } catch (err) {
            console.warn('Failed to fetch real-time LeetCode stats for member:', username, err)
          }
        }

        return {
          user_id: member.user_id,
          display_name: member.display_name,
          todayScore: todayLog?.score ?? null,
          todayLogged: !!todayLog,
          streak,
          weekAvg,
          studyHours: avgStudy ? parseFloat(avgStudy.toFixed(1)) : null,
          consistency,
          allTimeAvg,
          leetcodeSolvedToday,
          leetcodeTotalSolved,
          leetcodeStreak,
        }
      })
    )

    // Sort by today's score desc, unlogged at bottom
    stats.sort((a, b) => {
      if (a.todayLogged && !b.todayLogged) return -1
      if (!a.todayLogged && b.todayLogged) return 1
      return (b.todayScore || 0) - (a.todayScore || 0)
    })

    if (active) {
      setMemberStats(stats)
      setStatsLoading(false)
    }
  }

  async function createSquad() {
    if (!squadName.trim() || !displayName.trim()) return
    setSaving(true)
    setError('')

    const code = generateCode()

    const { data: squad, error: squadErr } = await supabase
      .from('squads')
      .insert({ name: squadName.trim(), code, created_by: user.id })
      .select()
      .single()

    if (squadErr || !squad) {
      setError('Failed to create squad.')
      setSaving(true)
      return
    }

    await supabase
      .from('squad_members')
      .insert({ squad_id: squad.id, user_id: user.id, display_name: displayName.trim() })

    setSquads(prev => [...prev, squad])
    setActiveSquad(squad)
    setShowCreate(false)
    setSaving(false)
    setSquadName('')
    await loadMemberStats(squad.id, user.id, true)
  }

  async function joinSquad() {
    if (!joinCode.trim() || !displayName.trim()) return
    setSaving(true)
    setError('')

    const { data: squad } = await supabase
      .from('squads')
      .select('*')
      .eq('code', joinCode.trim().toUpperCase())
      .maybeSingle()

    if (!squad) {
      setError('Squad code not found.')
      setSaving(false)
      return
    }

    const { data: existing } = await supabase
      .from('squad_members')
      .select('*')
      .eq('squad_id', squad.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      setError("You're already in this squad.")
      setSaving(false)
      return
    }

    await supabase
      .from('squad_members')
      .insert({ squad_id: squad.id, user_id: user.id, display_name: displayName.trim() })

    setSquads(prev => [...prev, squad])
    setActiveSquad(squad)
    setShowJoin(false)
    setSaving(false)
    setJoinCode('')
    await loadMemberStats(squad.id, user.id, true)
  }

  function copyCode() {
    if (!activeSquad) return
    navigator.clipboard.writeText(activeSquad.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyInviteLink() {
    if (!activeSquad) return
    const link = `${window.location.origin}/squad?code=${activeSquad.code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function leaveSquad() {
    if (!activeSquad || !user) return
    const confirmLeave = window.confirm(`Are you sure you want to leave the squad "${activeSquad.name}"?`)
    if (!confirmLeave) return

    try {
      const { error: leaveErr } = await supabase
        .from('squad_members')
        .delete()
        .eq('squad_id', activeSquad.id)
        .eq('user_id', user.id)

      if (leaveErr) {
        alert('Failed to leave squad: ' + leaveErr.message)
        return
      }

      // Update state
      const updatedSquads = squads.filter(s => s.id !== activeSquad.id)
      setSquads(updatedSquads)
      if (updatedSquads.length > 0) {
        setActiveSquad(updatedSquads[0])
        await loadMemberStats(updatedSquads[0].id, user.id, true)
      } else {
        setActiveSquad(null)
        setMemberStats([])
      }
    } catch (err: any) {
      alert('Error leaving squad: ' + err.message)
    }
  }

  const weeklyRanking = [...memberStats].sort((a, b) => b.weekAvg - a.weekAvg)

  return (
    <div className="text-neutral-100 font-sans">
      <div>

        <FadeIn className="flex items-start justify-between mb-10 pb-5 border-b border-neutral-900">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Squad Activity Matrix</h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Cross-profile telemetry & live discipline coordination
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false) }}
              className="text-xs font-mono font-bold tracking-widest uppercase text-neutral-400 hover:text-white px-4 py-2.5 rounded-xl border border-neutral-850 hover:border-neutral-700 bg-neutral-900/35 hover:bg-neutral-900/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] transition-all duration-200 cursor-pointer select-none"
            >
              Join squad
            </button>
            <motion.button
              whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setShowCreate(true); setShowJoin(false) }}
              className="text-xs font-mono font-bold tracking-widest uppercase bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 px-4.5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.45)] transition-all duration-300 cursor-pointer select-none"
            >
              Create squad
            </motion.button>
          </div>
        </FadeIn>

        {/* Create / Join forms */}
        <AnimatePresence>
          {(showCreate || showJoin) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 mb-8 shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-750 font-mono select-none pointer-events-none">
                [ {showCreate ? 'NEW VECTOR SQUAD' : 'ATTACH EXISTING POD'} ]
              </div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">
                {showCreate ? 'Configure new squadron' : 'Enter security access code'}
              </p>

              {showCreate && (
                <input
                  type="text"
                  placeholder="Squad name — e.g. DSA grinders"
                  value={squadName}
                  onChange={e => setSquadName(e.target.value)}
                  className="w-full bg-[#070708] border border-neutral-850 hover:border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 focus:shadow-[0_0_12px_rgba(16,185,129,0.1)] transition-all duration-300 mb-3 placeholder:text-neutral-700 font-sans"
                />
              )}

              {showJoin && (
                <input
                  type="text"
                  placeholder="6-digit code — e.g. AB12CD"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full bg-[#070708] border border-neutral-850 hover:border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 focus:shadow-[0_0_12px_rgba(16,185,129,0.1)] transition-all duration-300 mb-3 placeholder:text-neutral-700 font-mono tracking-widest"
                />
              )}

              <input
                type="text"
                placeholder="Your display name in this squad"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-[#070708] border border-neutral-850 hover:border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 focus:shadow-[0_0_12px_rgba(16,185,129,0.1)] transition-all duration-300 mb-4 placeholder:text-neutral-700 font-sans"
              />

              {error && (
                <p className="text-xs text-red-400 font-mono mb-4">{error}</p>
              )}

              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={showCreate ? createSquad : joinSquad}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 text-xs font-bold font-mono tracking-widest uppercase py-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-40 transition-all duration-300 select-none cursor-pointer"
                >
                  {saving ? 'SAVING DATA...' : showCreate ? 'INITIALIZE SQUAD' : 'ESTABLISH CONNECT'}
                </motion.button>
                <button
                  onClick={() => { setShowCreate(false); setShowJoin(false); setError('') }}
                  className="px-5 text-xs font-bold font-mono text-neutral-500 border border-neutral-850 rounded-xl hover:border-neutral-700 hover:text-neutral-350 hover:bg-neutral-900/40 transition-all duration-200 uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {squads.length === 0 && !showCreate && !showJoin ? (
          <FadeIn className="bg-neutral-900/35 border border-neutral-800/60 border-dashed rounded-2xl p-16 text-center">
            <p className="text-2xl mb-3">⚔️</p>
            <p className="text-sm text-white font-semibold mb-1">No squad connected yet</p>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mb-5">Create a deployment or join to compete with peers.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs font-bold font-mono tracking-widest uppercase bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 px-6 py-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300 cursor-pointer select-none"
            >
              Create your squad
            </button>
          </FadeIn>
        ) : activeSquad && (
          <>
            {/* Squad selector + invite */}
            <FadeIn className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8 p-3 rounded-2xl bg-neutral-900/25 border border-neutral-900/60 backdrop-blur-sm">
              <div className="flex flex-wrap gap-1.5">
                {squads.map(squad => {
                  const isActive = activeSquad.id === squad.id;
                  return (
                    <button
                      key={squad.id}
                      onClick={async () => {
                        setActiveSquad(squad)
                        await loadMemberStats(squad.id, user.id, true)
                      }}
                      className={`text-xs font-mono tracking-wider px-4.5 py-2 rounded-xl transition-all duration-200 select-none cursor-pointer ${
                        isActive
                          ? 'bg-neutral-850 text-white border border-neutral-800/60 font-bold shadow-[0_0_12px_rgba(255,255,255,0.03)]'
                          : 'text-neutral-500 hover:text-neutral-350 border border-transparent'
                      }`}
                    >
                      {squad.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={copyCode}
                  className="text-[10px] font-mono text-neutral-450 hover:text-emerald-450 hover:border-emerald-500/30 bg-[#0a0a0b]/80 border border-neutral-850 hover:bg-[#0f0f12] px-3.5 py-2 rounded-xl transition-all duration-250 tracking-widest font-semibold cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]"
                >
                  CODE: {activeSquad.code}
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={copyInviteLink}
                  className="text-[10px] font-mono text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/30 bg-[#0a0a0b]/80 border border-neutral-850 hover:bg-[#0f0f12] px-3.5 py-2 rounded-xl transition-all duration-250 cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]"
                >
                  {copied ? '✓ COPIED' : 'INVITE LINK'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={leaveSquad}
                  className="text-[10px] font-mono text-rose-500 hover:text-rose-400 hover:border-rose-500/30 bg-rose-950/10 border border-rose-950/30 px-3.5 py-2 rounded-xl transition-all duration-250 cursor-pointer"
                >
                  LEAVE SQUAD
                </motion.button>
              </div>
            </FadeIn>

            {/* View toggle */}
            <FadeIn className="flex gap-1.5 bg-neutral-950 border border-neutral-900/80 rounded-xl p-1 w-fit mb-6 shadow-inner">
              {(['daily', 'weekly', 'leetcode'] as const).map(v => {
                const isActive = view === v;
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`text-[10px] font-mono tracking-wider px-4.5 py-1.5 rounded-lg transition-all duration-200 capitalize select-none cursor-pointer ${
                      isActive
                        ? 'bg-neutral-850 text-white font-semibold shadow-sm border border-neutral-800/40'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {v === 'daily' ? "Today's board" : v === 'weekly' ? 'Weekly ranking' : '⌨️ LeetCode'}
                  </button>
                );
              })}
            </FadeIn>

            {statsLoading ? (
              <div className="flex items-center justify-center py-16">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs text-neutral-700 font-mono uppercase tracking-widest"
                >scanning stats matrix...</motion.div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {view === 'daily' && (
                  <motion.div
                    key="daily"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Daily header */}
                    <div className="grid grid-cols-5 gap-4 px-5 mb-3">
                      {['Member', "Today's score", 'Streak', 'Avg study', 'Consistency'].map(h => (
                        <p key={h} className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">{h}</p>
                      ))}
                    </div>

                    <FadeInStagger className="space-y-2.5">
                      {memberStats.map((m, i) => {
                        const isSelf = m.user_id === user?.id;
                        return (
                          <StaggerItem key={m.user_id}>
                            <div className={`grid grid-cols-5 gap-4 items-center border rounded-2xl px-5 py-4.5 transition-all duration-300 relative overflow-hidden group ${
                              isSelf
                                ? 'border-emerald-500/35 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.06),inset_0_0_12px_rgba(16,185,129,0.03)]'
                                : i === 0
                                  ? 'border-amber-500/25 bg-amber-950/5 shadow-[0_0_20px_rgba(245,158,11,0.04),inset_0_0_12px_rgba(245,158,11,0.02)]'
                                  : i === 1
                                    ? 'border-slate-400/20 bg-slate-900/10 shadow-[0_0_15px_rgba(148,163,184,0.03)]'
                                    : i === 2
                                      ? 'border-amber-750/20 bg-amber-950/5 shadow-[0_0_12px_rgba(180,83,9,0.02)]'
                                      : 'border-neutral-850 bg-neutral-900/35 hover:border-neutral-800/80 hover:bg-neutral-900/40'
                            }`}>
                              {/* Decorative left rank ribbon */}
                              <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${
                                isSelf ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                                i === 0 ? 'bg-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]' :
                                i === 1 ? 'bg-slate-450/40' :
                                i === 2 ? 'bg-amber-700/40' : 'bg-transparent'
                              }`} />
                              
                              {/* Glowing background highlights for top ranks */}
                              {isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/8 transition-all duration-500" />}
                              {i === 0 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/8 transition-all duration-500" />}
                              {i === 1 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-slate-400/3 rounded-full blur-2xl pointer-events-none group-hover:bg-slate-400/6 transition-all duration-500" />}
                              {i === 2 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-amber-700/3 rounded-full blur-2xl pointer-events-none" />}

                              <div className="flex items-center gap-3 z-10">
                                <div className={`text-xs font-mono w-10 text-left font-bold ${
                                  i === 0 ? 'text-amber-400' :
                                  i === 1 ? 'text-slate-350' :
                                  i === 2 ? 'text-amber-700' :
                                  'text-neutral-600 font-medium'
                                }`}>
                                  {i < 9 ? `[0${i + 1}]` : `[${i + 1}]`}
                                </div>
                                <div>
                                  <p className="text-sm text-white font-semibold flex items-center gap-1.5 font-sans">
                                    {m.display_name}
                                    {m.streak >= 7 && <span className="text-xs">🔥</span>}
                                  </p>
                                  {isSelf && (
                                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5 tracking-wider uppercase font-semibold">YOU</p>
                                  )}
                                </div>
                              </div>

                              <div className="z-10">
                                {m.todayLogged ? (
                                  <div className="flex items-center gap-2.5">
                                    <div className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className={`text-sm font-bold font-mono ${
                                        m.todayScore! >= 80 ? 'text-emerald-400' :
                                        m.todayScore! >= 60 ? 'text-amber-400' :
                                        'text-rose-450'
                                      }`}>{m.todayScore}%</span>
                                      <div className="flex-1 max-w-16 bg-neutral-955 rounded-full h-1 overflow-hidden border border-neutral-900 hidden sm:block">
                                        <div
                                          className={`h-full rounded-full ${
                                            m.todayScore! >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_6px_#10b981]' :
                                            m.todayScore! >= 60 ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_6px_#f59e0b]' :
                                            'bg-gradient-to-r from-rose-500 to-rose-450 shadow-[0_0_6px_#f43f5e]'
                                          }`}
                                          style={{ width: `${m.todayScore}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2.5">
                                    <div className="relative flex h-2 w-2">
                                      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-rose-500/40 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                                    </div>
                                    <span className="text-[10px] text-rose-500/70 font-mono uppercase tracking-wider font-semibold">NOT LOGGED</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 z-10">
                                <span className="text-sm font-semibold text-white font-mono">{m.streak}</span>
                                <span className="text-xs text-neutral-500 font-mono">days</span>
                              </div>

                              <div className="z-10">
                                <span className="text-sm text-neutral-300 font-mono">
                                  {m.studyHours ? `${m.studyHours}h` : '—'}
                                </span>
                              </div>

                              <div className="z-10">
                                <span className={`text-sm font-semibold font-mono ${
                                  m.consistency >= 80 ? 'text-emerald-400' :
                                  m.consistency >= 60 ? 'text-amber-400' :
                                  'text-neutral-500'
                                }`}>{m.consistency}%</span>
                              </div>
                            </div>
                          </StaggerItem>
                        );
                      })}
                    </FadeInStagger>
                  </motion.div>
                )}

                {view === 'weekly' && (
                  <motion.div
                    key="weekly"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-xs text-neutral-500 font-mono mb-4 uppercase tracking-widest pl-1">
                      Week of {weekStart} — Ranked by average score matrix
                    </p>

                    <FadeInStagger className="space-y-3">
                      {weeklyRanking.map((m, i) => {
                        const isSelf = m.user_id === user?.id;
                        return (
                          <StaggerItem key={m.user_id}>
                            <div className={`flex items-center gap-4 border rounded-2xl px-5 py-4.5 transition-all duration-300 relative overflow-hidden group ${
                              isSelf
                                ? 'border-emerald-500/35 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.06),inset_0_0_12px_rgba(16,185,129,0.03)]'
                                : i === 0
                                  ? 'border-amber-500/25 bg-amber-950/5 shadow-[0_0_20px_rgba(245,158,11,0.04),inset_0_0_12px_rgba(245,158,11,0.02)]'
                                  : i === 1
                                    ? 'border-slate-400/20 bg-slate-900/10 shadow-[0_0_15px_rgba(148,163,184,0.03)]'
                                    : i === 2
                                      ? 'border-amber-750/20 bg-amber-950/5 shadow-[0_0_12px_rgba(180,83,9,0.02)]'
                                      : 'border-neutral-850 bg-neutral-900/35 hover:border-neutral-800/80 hover:bg-neutral-900/40'
                            }`}>
                              {/* Decorative left rank ribbon */}
                              <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${
                                isSelf ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                                i === 0 ? 'bg-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]' :
                                i === 1 ? 'bg-slate-450/40' :
                                i === 2 ? 'bg-amber-700/40' : 'bg-transparent'
                              }`} />
                              
                              {/* Glowing background highlights for top ranks */}
                              {isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/8 transition-all duration-500" />}
                              {i === 0 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/8 transition-all duration-500" />}
                              {i === 1 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-slate-400/3 rounded-full blur-2xl pointer-events-none group-hover:bg-slate-400/6 transition-all duration-500" />}
                              {i === 2 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-amber-700/3 rounded-full blur-2xl pointer-events-none" />}

                              <div className={`text-xs font-mono w-10 text-left font-bold z-10 ${
                                i === 0 ? 'text-amber-400' :
                                i === 1 ? 'text-slate-350' :
                                i === 2 ? 'text-amber-700' :
                                'text-neutral-600 font-medium'
                              }`}>
                                {i < 9 ? `[0${i + 1}]` : `[${i + 1}]`}
                              </div>

                              <div className="flex-1 z-10">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="text-sm font-bold text-white font-sans">{m.display_name}</p>
                                  {isSelf && (
                                    <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider font-semibold">YOU</span>
                                  )}
                                  {m.streak >= 7 && <span className="text-xs">🔥</span>}
                                </div>
                                <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden border border-neutral-900">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${m.weekAvg}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                                    className={`h-full rounded-full ${
                                      isSelf ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_6px_#10b981]' :
                                      i === 0 ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_6px_#f59e0b]' :
                                      i === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-300 shadow-[0_0_6px_#94a3b8]' :
                                      'bg-gradient-to-r from-neutral-600 to-neutral-500'
                                    }`}
                                  />
                                </div>
                              </div>

                              <div className="text-right z-10 ml-4">
                                <div className="text-2xl font-bold text-white tracking-tight font-mono">{m.weekAvg}%</div>
                                <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">week avg</div>
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-right ml-4 border-l border-neutral-850 pl-4 z-10">
                                <div>
                                  <div className="text-xs font-semibold text-white font-mono">{m.streak}d</div>
                                  <div className="text-[9px] text-neutral-600 font-mono uppercase">streak</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white font-mono">{m.consistency}%</div>
                                  <div className="text-[9px] text-neutral-600 font-mono uppercase">cons.</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white font-mono">{m.studyHours ? `${m.studyHours}h` : '—'}</div>
                                  <div className="text-[9px] text-neutral-600 font-mono uppercase">study</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white font-mono">{m.allTimeAvg}%</div>
                                  <div className="text-[9px] text-neutral-600 font-mono uppercase">all-time</div>
                                </div>
                              </div>
                            </div>
                          </StaggerItem>
                        );
                      })}
                    </FadeInStagger>
                  </motion.div>
                )}

                {view === 'leetcode' && (
                  <motion.div
                    key="leetcode"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-xs text-neutral-500 font-mono mb-4 uppercase tracking-widest pl-1">
                      Today's LeetCode Board — Ranked by problems solved in last 24 hours
                    </p>

                    <FadeInStagger className="space-y-3">
                      {[...memberStats]
                        .sort((a, b) => b.leetcodeSolvedToday - a.leetcodeSolvedToday)
                        .map((m, i) => {
                          const isSelf = m.user_id === user?.id;
                          return (
                            <StaggerItem key={m.user_id}>
                              <div className={`flex items-center gap-4 border rounded-2xl px-5 py-4.5 transition-all duration-300 relative overflow-hidden group ${
                                isSelf
                                  ? 'border-emerald-500/35 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.06),inset_0_0_12px_rgba(16,185,129,0.03)]'
                                  : i === 0
                                    ? 'border-amber-500/25 bg-amber-950/5 shadow-[0_0_20px_rgba(245,158,11,0.04),inset_0_0_12px_rgba(245,158,11,0.02)]'
                                    : i === 1
                                      ? 'border-slate-400/20 bg-slate-900/10 shadow-[0_0_15px_rgba(148,163,184,0.03)]'
                                      : i === 2
                                        ? 'border-amber-750/20 bg-amber-950/5 shadow-[0_0_12px_rgba(180,83,9,0.02)]'
                                        : 'border-neutral-850 bg-neutral-900/35 hover:border-neutral-800/80 hover:bg-neutral-900/40'
                              }`}>
                                {/* Decorative left rank ribbon */}
                                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${
                                  isSelf ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                                  i === 0 ? 'bg-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]' :
                                  i === 1 ? 'bg-slate-450/40' :
                                  i === 2 ? 'bg-amber-700/40' : 'bg-transparent'
                                }`} />
                                
                                {/* Glowing background highlights for top ranks */}
                                {isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/8 transition-all duration-500" />}
                                {i === 0 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/8 transition-all duration-500" />}
                                {i === 1 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-slate-400/3 rounded-full blur-2xl pointer-events-none group-hover:bg-slate-400/6 transition-all duration-500" />}
                                {i === 2 && !isSelf && <div className="absolute -right-16 -top-16 w-36 h-36 bg-amber-700/3 rounded-full blur-2xl pointer-events-none" />}

                                <div className={`text-xs font-mono w-10 text-left font-bold z-10 ${
                                  i === 0 ? 'text-amber-400' :
                                  i === 1 ? 'text-slate-350' :
                                  i === 2 ? 'text-amber-700' :
                                  'text-neutral-600 font-medium'
                                }`}>
                                  {i < 9 ? `[0${i + 1}]` : `[${i + 1}]`}
                                </div>

                                <div className="flex-1 z-10">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-sm font-semibold text-white font-sans">{m.display_name}</p>
                                    {isSelf && (
                                      <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider font-semibold">YOU</span>
                                    )}
                                  </div>
                                  <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden border border-neutral-900">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: Math.max(...memberStats.map(x => x.leetcodeSolvedToday)) > 0
                                        ? `${(m.leetcodeSolvedToday / Math.max(...memberStats.map(x => x.leetcodeSolvedToday || 1))) * 100}%`
                                        : '0%'
                                      }}
                                      transition={{ duration: 0.6, delay: i * 0.1 }}
                                      className={`h-full rounded-full ${
                                        isSelf ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_6px_#10b981]' :
                                        i === 0 ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_6px_#f59e0b]' :
                                        i === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-300 shadow-[0_0_6px_#94a3b8]' :
                                        'bg-gradient-to-r from-neutral-600 to-neutral-500'
                                      }`}
                                    />
                                  </div>
                                </div>

                                <div className="text-right ml-4 z-10">
                                  <div className="text-2xl font-bold text-white tracking-tight font-mono">{m.leetcodeSolvedToday}</div>
                                  <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">solved today</div>
                                </div>

                                <div className="text-right ml-4 border-l border-neutral-850 pl-4 z-10">
                                  <div className="text-lg font-bold text-neutral-300 font-mono">
                                    {m.leetcodeTotalSolved !== null ? m.leetcodeTotalSolved : '—'}
                                  </div>
                                  <div className="text-[9px] text-neutral-600 font-mono uppercase mt-0.5">all-time</div>
                                </div>

                                <div className="text-right ml-4 border-l border-neutral-850 pl-4 min-w-[70px] z-10">
                                  <div className="text-lg font-bold text-white font-mono flex items-center justify-end gap-1">
                                    {m.leetcodeStreak}
                                    <span className="text-xs">🔥</span>
                                  </div>
                                  <div className="text-[9px] text-neutral-600 font-mono uppercase mt-0.5">streak</div>
                                </div>
                              </div>
                            </StaggerItem>
                          );
                        })}
                    </FadeInStagger>

                    {memberStats.every(m => m.leetcodeSolvedToday === 0) && (
                      <div className="bg-neutral-900/35 border border-neutral-800/80 border-dashed rounded-2xl p-12 text-center mt-4">
                        <p className="text-2xl mb-2">⌨️</p>
                        <p className="text-sm text-white font-medium mb-1">No LeetCode activity today</p>
                        <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest mt-1">
                          Solve problems and sync LeetCode in your profile to appear here
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function SquadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-neutral-700 font-mono"
        >loading...</motion.div>
      </div>
    }>
      <SquadContent />
    </Suspense>
  )
}

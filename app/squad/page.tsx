'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'

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

export default function SquadPage() {
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

  const [view, setView] = useState<'daily' | 'weekly'>('daily')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [squadName, setSquadName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  // Get Monday of current week
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().split('T')[0]
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
        setDisplayName(authUser.email?.split('@')[0] || '')
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

    const stats: MemberStats[] = await Promise.all(
      members.map(async (member) => {
        const { data: logs } = await supabase
          .from('daily_logs')
          .select('date, score, study_hours')
          .eq('user_id', member.user_id)
          .order('date', { ascending: false })
          .limit(30)

        const todayLog = logs?.find(l => l.date === today)
        const weekLogs = logs?.filter(l => l.date >= weekStart) || []
        const allLogs = logs || []

        // Streak
        let streak = 0
        const d = new Date()
        while (true) {
          const dateStr = d.toISOString().split('T')[0]
          if (allLogs.find(l => l.date === dateStr)) {
            streak++
            d.setDate(d.getDate() - 1)
          } else break
        }

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

    const { data: squad, error: squadError } = await supabase
      .from('squads')
      .insert({ name: squadName.trim(), code, created_by: user.id })
      .select()
      .single()

    if (squadError || !squad) {
      setError('Failed to create squad. Try again.')
      setSaving(false)
      return
    }

    await supabase.from('squad_members').insert({
      squad_id: squad.id,
      user_id: user.id,
      display_name: displayName.trim(),
    })

    setSquads(prev => [...prev, squad])
    setActiveSquad(squad)
    await loadMemberStats(squad.id, user.id, true)
    setShowCreate(false)
    setSquadName('')
    setSaving(false)
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
      setError('Invalid code. Check with your friend.')
      setSaving(false)
      return
    }

    const { error: joinError } = await supabase
      .from('squad_members')
      .insert({
        squad_id: squad.id,
        user_id: user.id,
        display_name: displayName.trim(),
      })

    if (joinError) {
      setError('Already in this squad or something went wrong.')
      setSaving(false)
      return
    }

    setSquads(prev => [...prev, squad])
    setActiveSquad(squad)
    await loadMemberStats(squad.id, user.id, true)
    setShowJoin(false)
    setJoinCode('')
    setSaving(false)
  }

  function copyInviteLink() {
    if (!activeSquad) return
    const link = `${window.location.origin}/squad?code=${activeSquad.code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyCode() {
    if (!activeSquad) return
    navigator.clipboard.writeText(activeSquad.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const weeklyRanking = [...memberStats].sort((a, b) => b.weekAvg - a.weekAvg)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-neutral-700 font-mono"
        >loading...</motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans">
      <main className="flex-1 max-w-4xl w-full mx-auto px-8 py-10">

        <FadeIn className="flex items-start justify-between mb-10 pb-5 border-b border-neutral-900">
          <div>
            <button
              onClick={() => router.push('/home')}
              className="text-neutral-600 hover:text-neutral-400 text-xs font-mono mb-2.5 block transition-colors uppercase tracking-wider"
            >← back</button>
            <h1 className="text-xl font-bold text-white tracking-tight">Squad Competitions</h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">Live daily matrix & weekly ranking analytics</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false) }}
              className="text-xs font-semibold text-neutral-400 hover:text-white px-4 py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-600 transition-colors uppercase tracking-wider"
            >
              Join squad
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowCreate(true); setShowJoin(false) }}
              className="text-xs font-bold bg-white text-black px-4 py-2.5 rounded-xl hover:bg-neutral-100 transition-colors uppercase tracking-wider"
            >
              Create squad
            </motion.button>
          </div>
        </FadeIn>

        {/* Create / Join forms */}
        <AnimatePresence>
          {(showCreate || showJoin) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 mb-6 shadow-xl"
            >
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">
                {showCreate ? 'Create a new squad' : 'Join a squad'}
              </p>

              {showCreate && (
                <input
                  type="text"
                  placeholder="Squad name — e.g. DSA grinders"
                  value={squadName}
                  onChange={e => setSquadName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors mb-3 placeholder:text-neutral-800"
                />
              )}

              {showJoin && (
                <input
                  type="text"
                  placeholder="6-digit code — e.g. AB12CD"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors mb-3 placeholder:text-neutral-800 font-mono tracking-widest"
                />
              )}

              <input
                type="text"
                placeholder="Your display name in this squad"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-600 transition-colors mb-4 placeholder:text-neutral-800"
              />

              {error && (
                <p className="text-xs text-red-400 font-mono mb-3">{error}</p>
              )}

              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={showCreate ? createSquad : joinSquad}
                  disabled={saving}
                  className="flex-1 bg-white text-black text-xs font-semibold py-3 rounded-xl hover:bg-neutral-100 transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving...' : showCreate ? 'Create' : 'Join'}
                </motion.button>
                <button
                  onClick={() => { setShowCreate(false); setShowJoin(false); setError('') }}
                  className="px-4 text-xs font-semibold text-neutral-500 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition-colors uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {squads.length === 0 && !showCreate && !showJoin ? (
          <FadeIn className="bg-neutral-900 border border-neutral-800/40 border-dashed rounded-2xl p-16 text-center shadow-inner">
            <p className="text-sm text-neutral-500 font-medium mb-1">No squad connections established.</p>
            <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Create a squad or enter a 6-digit invite code to compete</p>
          </FadeIn>
        ) : activeSquad && (
          <>
            {/* Squad selector + invite */}
            <FadeIn className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                {squads.map(squad => (
                  <button
                    key={squad.id}
                    onClick={async () => {
                      setActiveSquad(squad)
                      await loadMemberStats(squad.id, user.id, true)
                    }}
                    className={`text-xs px-4 py-2 rounded-lg transition-colors font-medium ${
                      activeSquad.id === squad.id
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-500 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    {squad.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={copyCode}
                  className="text-xs font-mono text-neutral-500 hover:text-white bg-neutral-900 border border-neutral-800/80 px-3.5 py-2 rounded-xl transition-colors tracking-widest font-semibold"
                >
                  CODE: {activeSquad.code}
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={copyInviteLink}
                  className="text-xs font-mono text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800/80 px-3.5 py-2 rounded-xl transition-colors"
                >
                  {copied ? '✓ COPIED' : 'INVITE LINK'}
                </motion.button>
              </div>
            </FadeIn>

            {/* View toggle */}
            <FadeIn className="flex gap-1 bg-neutral-900 border border-neutral-800/60 rounded-xl p-1 w-fit mb-6">
              {(['daily', 'weekly'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-[10px] font-mono px-4 py-1.5 rounded-lg transition-colors capitalize ${
                    view === v
                      ? 'bg-white text-black font-semibold'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {v === 'daily' ? "Today's board" : 'Weekly ranking'}
                </button>
              ))}
            </FadeIn>

            {statsLoading ? (
              <div className="flex items-center justify-center py-16">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-sm text-neutral-700 font-mono"
                >loading stats...</motion.div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {view === 'daily' ? (
                  <motion.div
                    key="daily"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Daily header */}
                    <div className="grid grid-cols-5 gap-4 px-4 mb-3">
                      {['Member', "Today's score", 'Streak', 'Avg study', 'Consistency'].map(h => (
                        <p key={h} className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">{h}</p>
                      ))}
                    </div>

                    <FadeInStagger className="space-y-2">
                      {memberStats.map((m, i) => (
                        <StaggerItem key={m.user_id}>
                          <div className={`grid grid-cols-5 gap-4 items-center bg-neutral-900 border rounded-xl px-5 py-4 shadow-sm ${
                            m.user_id === user?.id
                              ? 'border-neutral-600 shadow-md'
                              : 'border-neutral-800/80'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`text-xs font-mono w-5 text-center ${
                                i === 0 ? 'text-yellow-400' :
                                i === 1 ? 'text-neutral-400' :
                                i === 2 ? 'text-orange-600' :
                                'text-neutral-700'
                              }`}>
                                {i === 0 ? '①' : i === 1 ? '②' : i === 2 ? '③' : `${i + 1}`}
                              </div>
                              <div>
                                <p className="text-sm text-white font-semibold">{m.display_name}</p>
                                {m.user_id === user?.id && (
                                  <p className="text-[10px] text-neutral-600 font-mono mt-0.5">you</p>
                                )}
                              </div>
                            </div>

                            <div>
                              {m.todayLogged ? (
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold ${
                                    m.todayScore! >= 80 ? 'text-green-400' :
                                    m.todayScore! >= 60 ? 'text-yellow-400' :
                                    'text-red-400'
                                  }`}>{m.todayScore}%</span>
                                  <div className="flex-1 max-w-16 bg-neutral-800 rounded-full h-1 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        m.todayScore! >= 80 ? 'bg-green-500' :
                                        m.todayScore! >= 60 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${m.todayScore}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-neutral-600 font-mono uppercase">not logged</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white">{m.streak}</span>
                              <span className="text-xs text-neutral-600 font-mono">days</span>
                              {m.streak >= 7 && <span className="text-xs">🔥</span>}
                            </div>

                            <div>
                              <span className="text-sm text-neutral-300 font-mono">
                                {m.studyHours ? `${m.studyHours}h` : '—'}
                              </span>
                            </div>

                            <div>
                              <span className={`text-sm font-medium font-mono ${
                                m.consistency >= 80 ? 'text-green-400' :
                                m.consistency >= 60 ? 'text-yellow-400' :
                                'text-neutral-400'
                              }`}>{m.consistency}%</span>
                            </div>
                          </div>
                        </StaggerItem>
                      ))}
                    </FadeInStagger>
                  </motion.div>
                ) : (
                  <motion.div
                    key="weekly"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-xs text-neutral-500 font-mono mb-4">
                      WEEK OF {weekStart} — RANKED BY AVERAGE SCORE
                    </p>

                    <FadeInStagger className="space-y-3">
                      {weeklyRanking.map((m, i) => (
                        <StaggerItem key={m.user_id}>
                          <div className={`flex items-center gap-4 bg-neutral-900 border rounded-2xl px-5 py-4 ${
                            m.user_id === user?.id ? 'border-neutral-600' : 'border-neutral-800/80'
                          }`}>
                            <div className={`text-2xl font-bold w-8 text-center ${
                              i === 0 ? 'text-yellow-400' :
                              i === 1 ? 'text-neutral-400' :
                              i === 2 ? 'text-orange-600' :
                              'text-neutral-700'
                            }`}>
                              {i + 1}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-sm font-bold text-white">{m.display_name}</p>
                                {m.user_id === user?.id && (
                                  <span className="text-[10px] text-neutral-600 font-mono uppercase">you</span>
                                )}
                                {m.streak >= 7 && <span className="text-xs">🔥</span>}
                              </div>
                              <div className="w-full bg-neutral-850 rounded-full h-1 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${m.weekAvg}%` }}
                                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                                  className={`h-full rounded-full ${
                                    i === 0 ? 'bg-yellow-500' :
                                    i === 1 ? 'bg-neutral-400' :
                                    'bg-neutral-600'
                                  }`}
                                />
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-2xl font-bold text-white tracking-tight">{m.weekAvg}%</div>
                              <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">week avg</div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right ml-4 border-l border-neutral-850 pl-4">
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
                      ))}
                    </FadeInStagger>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}
      </main>
    </div>
  )
}

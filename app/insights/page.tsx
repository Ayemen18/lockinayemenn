'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'

type Insight = {
  id: string
  generated_at: string
  week_start: string
  week_end: string
  avg_score: number
  report: string
}

export default function InsightsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeReport, setActiveReport] = useState<Insight | null>(null)
  const [error, setError] = useState('')
  const [logCount, setLogCount] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: insightsData } = await supabase
          .from('insights')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })

        const { count } = await supabase
          .from('daily_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (active) {
          if (insightsData) {
            setInsights(insightsData)
            if (insightsData.length > 0) setActiveReport(insightsData[0])
          }
          setLogCount(count || 0)
        }
      } catch (err) {
        console.error('Error loading insights data:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [router])

  async function generate() {
    if (logCount < 3) {
      setError('Log at least 3 days before generating an analysis.')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/insights', { method: 'POST' })
      
      let data
      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        data = await res.json()
      } else {
        const rawResponse = await res.text()
        console.error('Server returned non-JSON response:', rawResponse)
        setError(`Server error (HTTP ${res.status}): ${rawResponse.slice(0, 150)}...`)
        setGenerating(false)
        return
      }

      if (data.error) {
        setError(data.error)
        setGenerating(false)
        return
      }

      // Reload insights
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: fresh } = await supabase
          .from('insights')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })

        if (fresh) {
          setInsights(fresh)
          setActiveReport(fresh[0])
        }
      }
    } catch (err) {
      console.error('Error generating analysis:', err)
      setError('Something went wrong. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  function formatReport(report: string) {
    let currentSection = 'general';
    return report.split('\n').map((line, i) => {
      const cleanLine = line.trim()
      if (cleanLine.startsWith('**') && cleanLine.endsWith('**')) {
        const headerText = cleanLine.replace(/\*\*/g, '');
        const lower = headerText.toLowerCase();
        if (lower.includes('strength') || lower.includes('positive') || lower.includes('win') || lower.includes('asset')) {
          currentSection = 'strengths';
        } else if (lower.includes('blocker') || lower.includes('challenge') || lower.includes('risk') || lower.includes('weakness') || lower.includes('friction')) {
          currentSection = 'blockers';
        } else if (lower.includes('recommend') || lower.includes('action') || lower.includes('advice') || lower.includes('next') || lower.includes('strategy')) {
          currentSection = 'recommendations';
        } else {
          currentSection = 'general';
        }
        
        let headerColor = 'text-neutral-500';
        if (currentSection === 'strengths') headerColor = 'text-emerald-400';
        if (currentSection === 'blockers') headerColor = 'text-rose-450';
        if (currentSection === 'recommendations') headerColor = 'text-cyan-450';

        return (
          <h4 key={i} className={`text-xs ${headerColor} font-mono uppercase tracking-widest mt-8 mb-4 first:mt-0 font-bold flex items-center gap-2`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
            {headerText}
          </h4>
        )
      }
      if (cleanLine === '') return null
      
      const match = cleanLine.match(/^(\d+)\.\s*(.*)/)
      
      if (currentSection === 'strengths') {
        return (
          <div key={i} className="mb-3 bg-emerald-950/10 border border-emerald-900/35 hover:border-emerald-800/50 rounded-xl px-4.5 py-3.5 shadow-[inset_2px_0_10px_rgba(16,185,129,0.03)] hover:shadow-[0_2px_12px_rgba(16,185,129,0.05)] transition-all duration-300 flex gap-3.5 items-start">
            <span className="text-emerald-400 font-mono text-[12px] flex-shrink-0 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/30">
              {match ? match[1] : '✓'}
            </span>
            <p className="text-[13px] text-neutral-350 leading-relaxed font-sans">{match ? match[2] : cleanLine}</p>
          </div>
        )
      }
      
      if (currentSection === 'blockers') {
        return (
          <div key={i} className="mb-3 bg-rose-950/10 border border-rose-900/35 hover:border-rose-800/50 rounded-xl px-4.5 py-3.5 shadow-[inset_2px_0_10px_rgba(244,63,94,0.03)] hover:shadow-[0_2px_12px_rgba(244,63,94,0.05)] transition-all duration-300 flex gap-3.5 items-start">
            <span className="text-rose-400 font-mono text-[12px] flex-shrink-0 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/30">
              {match ? match[1] : '⚠'}
            </span>
            <p className="text-[13px] text-neutral-350 leading-relaxed font-sans">{match ? match[2] : cleanLine}</p>
          </div>
        )
      }

      if (currentSection === 'recommendations') {
        return (
          <div key={i} className="mb-3 bg-cyan-950/10 border border-cyan-900/35 hover:border-cyan-800/50 rounded-xl px-4.5 py-3.5 shadow-[inset_2px_0_10px_rgba(6,182,212,0.03)] hover:shadow-[0_2px_12px_rgba(6,182,212,0.05)] transition-all duration-300 flex gap-3.5 items-start">
            <span className="text-cyan-400 font-mono text-[12px] flex-shrink-0 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900/30">
              {match ? match[1] : '⚡'}
            </span>
            <p className="text-[13px] text-neutral-350 leading-relaxed font-sans">{match ? match[2] : cleanLine}</p>
          </div>
        )
      }

      if (match) {
        return (
          <div key={i} className="flex gap-3 mb-3 pl-1">
            <span className="text-emerald-500 font-mono text-sm flex-shrink-0 font-semibold">{match[1]}.</span>
            <p className="text-sm text-neutral-300 leading-relaxed">{match[2]}</p>
          </div>
        )
      }
      return (
        <p key={i} className="text-sm text-neutral-300 leading-relaxed mb-3.5 pl-1">
          {cleanLine}
        </p>
      )
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
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

        <FadeIn className="flex items-start justify-between mb-8 border-b border-neutral-900 pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">AI Discipline Coach</h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              AI Coach pattern analysis & daily habit correlation feedback
            </p>
          </div>

          <motion.button
            onClick={generate}
            disabled={generating || logCount < 3}
            whileHover={{ scale: generating ? 1 : 1.015, filter: 'brightness(1.1)' }}
            whileTap={{ scale: 0.985 }}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 text-xs font-bold font-mono tracking-widest uppercase px-5 py-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.45)] transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer"
          >
            {generating ? (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                ANALYZING PATTERNS...
              </motion.span>
            ) : 'GENERATE ANALYSIS'}
          </motion.button>
        </FadeIn>

        {error && (
          <FadeIn className="bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs text-red-400 font-mono font-medium">{error}</p>
          </FadeIn>
        )}

        {logCount < 3 && (
          <FadeIn className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 mb-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-750 font-mono select-none pointer-events-none">
              [ REQUIREMENT STATUS ]
            </div>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">
              Unlock AI analysis
            </p>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed font-mono text-[13px]">
              Log at least 3 days of discipline data to enable advanced vector insights.
            </p>
            <div className="w-full bg-neutral-950 rounded-full h-2 mt-3 overflow-hidden border border-neutral-900">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((logCount / 3) * 100, 100)}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              />
            </div>
            <p className="text-xs text-neutral-600 font-mono mt-2">{logCount} / 3 days recorded</p>
          </FadeIn>
        )}

        <div className="grid grid-cols-3 gap-6 items-start">

          {/* Report history sidebar */}
          {insights.length > 0 && (
            <FadeIn className="col-span-1">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4 pl-1">
                past reports
              </p>
              {/* Timeline Container */}
              <div className="relative pl-6">
                {/* Vertical timeline track line */}
                <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-neutral-800/60" />
                
                <div className="space-y-3.5">
                  {insights.map(insight => {
                    const isActive = activeReport?.id === insight.id;
                    return (
                      <div key={insight.id} className="relative group">
                        {/* Timeline Node Point Indicator */}
                        <motion.div
                          animate={{
                            borderColor: isActive ? '#10b981' : '#262626',
                            backgroundColor: isActive ? '#10b981' : '#0a0a0a',
                            boxShadow: isActive ? '0 0 10px #10b981' : 'none'
                          }}
                          className="absolute -left-[21px] top-6 w-2.5 h-2.5 rounded-full border border-neutral-800 bg-neutral-950 transition-all duration-300 z-10"
                        />
                        
                        <motion.button
                          onClick={() => setActiveReport(insight)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 select-none relative ${
                            isActive
                              ? 'bg-neutral-900 border-neutral-750/70 shadow-md shadow-neutral-950/40'
                              : 'bg-neutral-900/35 border-neutral-850/50 hover:border-neutral-800/80 hover:bg-neutral-900/40'
                          }`}
                        >
                          <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                            {new Date(insight.generated_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric'
                            })}
                          </div>
                          <div className="text-sm font-bold text-white mt-1 font-mono">
                            {insight.avg_score}% avg score
                          </div>
                          <div className="text-[10px] text-neutral-600 font-mono mt-1">
                            {insight.week_start} → {insight.week_end.slice(-5)}
                          </div>
                        </motion.button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Active report container */}
          <div className={`${insights.length > 0 ? 'col-span-2' : 'col-span-3'} min-h-0`}>
            <AnimatePresence mode="wait">
              {activeReport ? (
                <motion.div
                  key={activeReport.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/85 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.4)] overflow-visible relative"
                >
                  <div className="absolute top-0 right-0 p-4 text-[9px] text-neutral-700 font-mono tracking-widest select-none pointer-events-none">[ COACH LOG: ANALYZED ]</div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800/60 z-10 relative">
                    <div>
                      <p className="text-xs text-neutral-500 font-mono font-medium">
                        RANGE: {activeReport.week_start} — {activeReport.week_end}
                      </p>
                      <p className="text-[10px] text-neutral-600 font-mono mt-1">
                        Compiled {new Date(activeReport.generated_at).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white tracking-tight font-mono">{activeReport.avg_score}%</div>
                      <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">avg score</div>
                    </div>
                  </div>

                  <div className="prose prose-invert max-w-none overflow-visible font-sans z-10 relative">
                    {formatReport(activeReport.report)}
                  </div>
                </motion.div>
              ) : generating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-12 flex flex-col items-center justify-center shadow-inner min-h-[300px] relative overflow-hidden"
                >
                  {/* Glowing scanline sweep */}
                  <motion.div
                    animate={{ y: [-100, 200, -100] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.5)] pointer-events-none"
                  />
                  
                  {/* Radar grid loader HUD */}
                  <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      className="absolute w-20 h-20 border border-dashed border-emerald-500/25 rounded-full"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                      className="absolute w-14 h-14 border border-dashed border-cyan-500/30 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </motion.div>
                  </div>
                  
                  <p className="text-xs text-neutral-400 font-mono uppercase tracking-widest">Analyzing habit patterns...</p>
                  <p className="text-[10px] text-neutral-600 font-mono mt-2 uppercase">analyzing log history and finding consistency bottlenecks</p>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-neutral-900/20 border border-neutral-800/50 border-dashed rounded-2xl p-12 text-center"
                >
                  <p className="text-sm text-neutral-500 font-medium mb-1">No analysis records compiled yet.</p>
                  <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
                    Click "GENERATE ANALYSIS" to request your first coach report
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  )
}

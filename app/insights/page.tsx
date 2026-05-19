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
    return report.split('\n').map((line, i) => {
      const cleanLine = line.trim()
      if (cleanLine.startsWith('**') && cleanLine.endsWith('**')) {
        return (
          <h4 key={i} className="text-xs text-neutral-500 font-mono uppercase tracking-widest mt-6 mb-3 first:mt-0 font-semibold">
            {cleanLine.replace(/\*\*/g, '')}
          </h4>
        )
      }
      if (cleanLine === '') return null
      
      const match = cleanLine.match(/^(\d+)\.\s*(.*)/)
      if (match) {
        return (
          <div key={i} className="flex gap-3 mb-2.5 pl-1">
            <span className="text-green-500 font-mono text-sm flex-shrink-0 font-semibold">{match[1]}.</span>
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
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans">
      <main className="flex-1 max-w-3xl w-full mx-auto px-8 py-10">

        <FadeIn className="flex items-start justify-between mb-8 border-b border-neutral-900 pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">AI Discipline Coach</h1>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Advanced behavior vector analysis & daily trend matrix processing
            </p>
          </div>

          <motion.button
            onClick={generate}
            disabled={generating || logCount < 3}
            whileHover={{ scale: generating ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white text-black text-xs font-semibold px-4.5 py-2.5 rounded-xl hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none shadow-sm"
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
          <FadeIn className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 mb-6">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-3">
              Unlock AI analysis
            </p>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
              Log at least 3 days of discipline data to enable advanced vector insights.
            </p>
            <div className="flex gap-1.5 h-1 bg-neutral-950 rounded-full overflow-hidden border border-neutral-850">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-full flex-1 transition-all duration-500 ${
                    i < logCount ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-neutral-600 font-mono mt-3 uppercase tracking-wider">{logCount} / 3 days recorded</p>
          </FadeIn>
        )}

        <div className="grid grid-cols-3 gap-6">

          {/* Report history sidebar */}
          {insights.length > 0 && (
            <FadeIn className="col-span-1">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">
                past reports
              </p>
              <div className="space-y-2">
                {insights.map(insight => (
                  <motion.button
                    key={insight.id}
                    onClick={() => setActiveReport(insight)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 select-none ${
                      activeReport?.id === insight.id
                        ? 'bg-neutral-900 border-neutral-700/80 shadow-md'
                        : 'bg-neutral-900/40 border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                      {new Date(insight.generated_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric'
                      })}
                    </div>
                    <div className="text-sm font-bold text-white mt-1">
                      {insight.avg_score}% avg score
                    </div>
                    <div className="text-[10px] text-neutral-600 font-mono mt-1">
                      {insight.week_start} → {insight.week_end.slice(-5)}
                    </div>
                  </motion.button>
                ))}
              </div>
            </FadeIn>
          )}

          {/* Active report container */}
          <div className={insights.length > 0 ? 'col-span-2' : 'col-span-3'}>
            <AnimatePresence mode="wait">
              {activeReport ? (
                <motion.div
                  key={activeReport.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800/60">
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
                      <div className="text-3xl font-bold text-white tracking-tight">{activeReport.avg_score}%</div>
                      <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">avg score</div>
                    </div>
                  </div>

                  <div className="font-sans">
                    {formatReport(activeReport.report)}
                  </div>
                </motion.div>
              ) : generating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-12 flex flex-col items-center justify-center shadow-inner"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full mb-4 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                  />
                  <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest">Vectorizing behavior data...</p>
                  <p className="text-[10px] text-neutral-700 font-mono mt-1.5 uppercase">Takes approximately 10 seconds</p>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-neutral-900 border border-neutral-800/40 border-dashed rounded-2xl p-12 text-center"
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
      </main>
    </div>
  )
}

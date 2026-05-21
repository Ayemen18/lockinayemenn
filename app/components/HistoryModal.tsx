'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { Log, Habit } from '../types'

type HistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  date: string
  log?: Log
  habits: Habit[]
}

const colorSchemes = [
  'border-green-900/30 text-green-400 bg-green-950/20',
  'border-orange-900/30 text-orange-400 bg-orange-950/20',
  'border-rose-900/30 text-rose-400 bg-rose-950/20',
  'border-purple-900/30 text-purple-400 bg-purple-950/20',
  'border-pink-900/30 text-pink-400 bg-pink-950/20',
  'border-cyan-900/30 text-cyan-400 bg-cyan-950/20',
  'border-yellow-900/30 text-yellow-400 bg-yellow-950/20',
  'border-blue-900/30 text-blue-400 bg-blue-950/20',
  'border-emerald-900/30 text-emerald-400 bg-emerald-950/20',
]

function getCategoryClass(category: string) {
  const upper = (category || 'STUDY').toUpperCase()
  switch (upper) {
    case 'STUDY': return colorSchemes[0]
    case 'HEALTH': return colorSchemes[1]
    case 'FITNESS': return colorSchemes[2]
    case 'MINDSET': return colorSchemes[3]
    case 'SOCIAL': return colorSchemes[4]
    case 'CODING': return colorSchemes[5]
    case 'BUSINESS': return colorSchemes[6]
    case 'SPIRITUAL': return colorSchemes[7]
    case 'CAREER': return colorSchemes[8]
    default: {
      let hash = 0
      for (let i = 0; i < upper.length; i++) {
        hash = upper.charCodeAt(i) + ((hash << 5) - hash)
      }
      const index = Math.abs(hash) % colorSchemes.length
      return colorSchemes[index]
    }
  }
}

export default function HistoryModal({ isOpen, onClose, date, log, habits }: HistoryModalProps) {
  // Format the date beautifully (e.g., Monday, May 18, 2026)
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-[6px] cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800/80 rounded-2xl max-w-md w-full p-6 relative overflow-hidden z-10 shadow-[0_0_50px_rgba(0,0,0,0.85)] border-t-neutral-750/70 flex flex-col max-h-[85vh] font-sans"
          >
            
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-neutral-800/80 pb-4 mb-4">
              <div>
                <span className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest block mb-0.5">Historical Log</span>
                <h3 className="text-sm font-bold text-white tracking-tight">{formattedDate}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg hover:bg-neutral-800 border border-transparent hover:border-neutral-700/50 flex items-center justify-center text-neutral-400 hover:text-white transition-all outline-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content section */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
              
              {!log ? (
                /* Empty state */
                <div className="text-center py-10 space-y-2">
                  <div className="text-2xl text-neutral-700">▱</div>
                  <p className="text-xs text-neutral-500 font-mono">No checklist entries logged for this date.</p>
                </div>
              ) : (
                /* Data state */
                <>
                  {/* Score capsule */}
                  <div className="bg-neutral-950/80 border border-neutral-900 p-4 rounded-xl flex items-center justify-between shadow-inner">
                    <div>
                      <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Completion score</p>
                      <p className="text-xs text-neutral-500 font-mono mt-1">
                        {log.earned_points} / {log.total_points} total points earned
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold tracking-tight font-mono ${
                        log.score >= 80 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]' : log.score >= 60 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'text-neutral-400'
                      }`}>
                        {log.score}%
                      </span>
                    </div>
                  </div>

                  {/* Checklist details */}
                  <div className="space-y-2.5">
                    <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest">Habit checklist</p>
                    
                    <div className="border border-neutral-900/60 rounded-xl overflow-hidden divide-y divide-neutral-900/40">
                      {habits.map(habit => {
                        const isCompleted = log.completed_habit_ids?.includes(habit.id)
                        return (
                          <div
                            key={habit.id}
                            className={`flex items-center gap-3 px-4 py-3 bg-neutral-900/20 text-xs transition-colors ${
                              isCompleted ? 'bg-neutral-950/20' : ''
                            }`}
                          >
                            {/* Checkmark icon indicator */}
                            <div className={`w-5 h-5 rounded-[6px] flex items-center justify-center flex-shrink-0 border transition-all duration-300 ${
                              isCompleted ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]' : 'border-neutral-850 bg-neutral-950/40 text-neutral-700'
                            }`}>
                              {isCompleted ? '✓' : ''}
                            </div>
                            
                            {/* Title */}
                            <span className={`flex-1 font-medium ${
                              isCompleted ? 'text-neutral-550 line-through' : 'text-neutral-300'
                            }`}>
                              {habit.name}
                            </span>

                            {/* Pts Weight */}
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono font-medium ${getCategoryClass(habit.category)}`}>
                              {habit.points} pts
                            </span>
                          </div>
                        )
                      })}

                      {habits.length === 0 && (
                        <p className="text-center py-4 text-xs text-neutral-600 italic font-mono">No active habits stored.</p>
                      )}
                    </div>
                  </div>

                  {/* Parameter stats */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-neutral-950/80 border border-neutral-900/60 p-3.5 rounded-xl shadow-inner">
                      <p className="text-[9px] text-neutral-550 font-mono uppercase tracking-widest mb-1.5">Study Focus</p>
                      <p className="text-sm font-extrabold text-white font-mono">
                        {log.study_hours !== undefined && log.study_hours !== null 
                          ? `${log.study_hours} hrs` 
                          : <span className="text-xs text-neutral-700 font-mono">Not logged</span>
                        }
                      </p>
                    </div>

                    <div className="bg-neutral-950/80 border border-neutral-900/60 p-3.5 rounded-xl shadow-inner">
                      <p className="text-[9px] text-neutral-550 font-mono uppercase tracking-widest mb-1.5">Sleep logged</p>
                      <p className="text-sm font-extrabold text-white font-mono">
                        {log.sleep_time
                          ? `${log.sleep_time} hrs` 
                          : <span className="text-xs text-neutral-700 font-mono">Not logged</span>
                        }
                      </p>
                    </div>
                  </div>

                  {/* Journal Reflection */}
                  <div className="bg-neutral-950/80 border border-neutral-900/60 p-4 rounded-xl shadow-inner">
                    <p className="text-[9px] text-neutral-555 font-mono uppercase tracking-widest mb-2">Daily reflection</p>
                    {log.reflection ? (
                      <p className="text-xs text-neutral-300 leading-relaxed italic">
                        "{log.reflection}"
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-650 italic font-mono">No reflection entry recorded.</p>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* Footer action */}
            <div className="mt-5 pt-3.5 border-t border-neutral-800/80 flex justify-end">
              <button
                onClick={onClose}
                className="bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold px-4 py-2 rounded-xl text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

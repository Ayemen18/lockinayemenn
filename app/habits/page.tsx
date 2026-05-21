'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, FadeInStagger, StaggerItem } from '../components/FadeIn'

type Habit = {
  id: string
  name: string
  category: string
  points: number
  sort_order: number
}

const standardCategories = [
  'STUDY',
  'HEALTH',
  'FITNESS',
  'MINDSET',
  'SOCIAL',
  'CODING',
  'BUSINESS',
  'SPIRITUAL',
  'CAREER'
]

const colorSchemes = [
  { text: 'text-green-400 bg-green-950/60 border border-green-900/30 shadow-[0_0_8px_rgba(74,222,128,0.08)]', bg: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' },
  { text: 'text-orange-400 bg-orange-950/60 border border-orange-900/30 shadow-[0_0_8px_rgba(251,146,60,0.08)]', bg: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' },
  { text: 'text-rose-400 bg-rose-950/60 border border-rose-900/30 shadow-[0_0_8px_rgba(251,113,133,0.08)]', bg: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' },
  { text: 'text-purple-400 bg-purple-950/60 border border-purple-900/30 shadow-[0_0_8px_rgba(192,132,252,0.08)]', bg: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]' },
  { text: 'text-pink-400 bg-pink-950/60 border border-pink-900/30 shadow-[0_0_8px_rgba(244,114,182,0.08)]', bg: 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]' },
  { text: 'text-cyan-400 bg-cyan-950/60 border border-cyan-900/30 shadow-[0_0_8px_rgba(34,211,238,0.08)]', bg: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' },
  { text: 'text-yellow-400 bg-yellow-950/60 border border-yellow-900/30 shadow-[0_0_8px_rgba(250,204,21,0.08)]', bg: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]' },
  { text: 'text-blue-400 bg-blue-950/60 border border-blue-900/30 shadow-[0_0_8px_rgba(96,165,250,0.08)]', bg: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' },
  { text: 'text-emerald-400 bg-emerald-950/60 border border-emerald-900/30 shadow-[0_0_8px_rgba(52,211,153,0.08)]', bg: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' },
]

function getCategoryScheme(category: string) {
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

const empty = { name: '', category: 'STUDY', points: 10 }

export default function HabitsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')

  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryText, setCustomCategoryText] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
    if (data) setHabits(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCategoryChange = (val: string) => {
    if (val === 'ADD_CUSTOM_NEW') {
      setIsCustomCategory(true)
      setCustomCategoryText('')
      setForm(f => ({ ...f, category: '' }))
    } else {
      setIsCustomCategory(false)
      setForm(f => ({ ...f, category: val }))
    }
  }

  async function saveNew() {
    if (!form.name.trim()) return
    const finalCategory = isCustomCategory ? customCategoryText.trim().toUpperCase() : form.category.trim().toUpperCase()
    if (!finalCategory) {
      alert('Please enter a custom category name.')
      return
    }
    
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('User is not authenticated. Please log in.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('habits').insert({
      user_id: user.id,
      name: form.name.trim(),
      category: finalCategory,
      points: form.points,
      sort_order: habits.length + 1,
    })

    if (error) {
      alert(`Failed to save habit: ${error.message}`)
      setSaving(false)
      return
    }

    setForm(empty)
    setIsCustomCategory(false)
    setCustomCategoryText('')
    setSaving(false)
    setActiveTab('all')
    load()
  }

  async function saveEdit(id: string) {
    if (!form.name.trim()) return
    const finalCategory = isCustomCategory ? customCategoryText.trim().toUpperCase() : form.category.trim().toUpperCase()
    if (!finalCategory) {
      alert('Please enter a custom category name.')
      return
    }
    
    setSaving(true)

    const { error } = await supabase.from('habits').update({
      name: form.name.trim(),
      category: finalCategory,
      points: form.points,
    }).eq('id', id)

    if (error) {
      alert(`Failed to update habit: ${error.message}`)
      setSaving(false)
      return
    }

    setEditingId(null)
    setForm(empty)
    setIsCustomCategory(false)
    setCustomCategoryText('')
    setSaving(false)
    setActiveTab('all')
    load()
  }

  async function deleteHabit(id: string) {
    const { error } = await supabase.from('habits').delete().eq('id', id)
    if (error) {
      alert(`Failed to delete habit: ${error.message}`)
      return
    }
    // Reset form if we were editing this specific habit
    if (editingId === id) {
      setEditingId(null)
      setForm(empty)
      setIsCustomCategory(false)
      setCustomCategoryText('')
    }
    load()
  }

  async function moveHabit(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= habits.length) return

    const updated = [...habits]
    const temp = updated[index]
    updated[index] = updated[swapIndex]
    updated[swapIndex] = temp

    const newHabits = updated.map((h, i) => ({ ...h, sort_order: i + 1 }))
    setHabits(newHabits)

    await Promise.all(
      newHabits.map(h =>
        supabase.from('habits').update({ sort_order: h.sort_order }).eq('id', h.id)
      )
    )
  }

  const totalPoints = habits.reduce((s, h) => s + h.points, 0)
  
  // Get all unique categories (standard categories + any custom ones existing in habits)
  const categoriesList = Array.from(new Set([
    ...standardCategories,
    ...habits.map(h => h.category.toUpperCase())
  ]))

  // Calculate points breakdown per category
  const pointsBreakdown = categoriesList.map(cat => {
    const total = habits.filter(h => h.category.toUpperCase() === cat).reduce((s, h) => s + h.points, 0)
    const percentage = totalPoints > 0 ? Math.round((total / totalPoints) * 100) : 0
    return { category: cat, points: total, percentage }
  })

  // Filter habits based on active tab
  const filteredHabits = habits.filter(h => activeTab === 'all' || h.category.toUpperCase() === activeTab)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-sm text-neutral-700 font-mono"
          >
            loading habits...
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-neutral-100 font-sans">
      <div>
        
        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column (2/3 width) - Habits List */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Header info */}
            <FadeIn className="flex items-end justify-between border-b border-neutral-900 pb-5">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Habits</h1>
                <p className="text-xs text-neutral-500 font-mono mt-1">
                  {habits.length} total habits active · {totalPoints} total points weight
                </p>
              </div>

              {/* Quick Tab Filters */}
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-900/60 overflow-x-auto max-w-full no-scrollbar">
                {['all', ...categoriesList].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative px-2.5 py-1 text-[10px] uppercase font-mono tracking-wider rounded-md transition-colors duration-200 flex-shrink-0 cursor-pointer ${
                      activeTab === tab ? 'text-white' : 'text-neutral-600 hover:text-neutral-400'
                    }`}
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeHabitTab"
                        className="absolute inset-0 bg-neutral-900 rounded-md -z-10 border border-neutral-800/40"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    {tab}
                  </button>
                ))}
              </div>
            </FadeIn>
            {/* List block */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredHabits.map((habit, index) => {
                  // Find original index in master list for sorting
                  const originalIndex = habits.findIndex(h => h.id === habit.id)
                  const categoryScheme = getCategoryScheme(habit.category)
                  
                  return (
                    <motion.div
                      key={habit.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-center gap-4 px-4 py-3 bg-neutral-900/15 backdrop-blur-sm border rounded-2xl transition-all duration-300 group relative overflow-hidden pl-7 ${
                        editingId === habit.id 
                          ? 'border-neutral-600 bg-neutral-900/40 shadow-[0_0_15px_rgba(255,255,255,0.03)]' 
                          : 'border-neutral-850/60 hover:border-neutral-800 hover:bg-neutral-900/25'
                      }`}
                    >
                      {/* Left vertical color boundary ribbon */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${categoryScheme.bg}`} />

                      {/* Sort arrows */}
                      <div className="flex flex-col gap-1 z-10">
                        <motion.button
                          whileHover={{ scale: 1.15, y: -1 }}
                          onClick={() => moveHabit(originalIndex, 'up')}
                          disabled={originalIndex === 0}
                          className="text-neutral-650 hover:text-neutral-200 disabled:opacity-5 transition-colors leading-none cursor-pointer p-0.5"
                          title="Move Up"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="m18 15-6-6-6 6" />
                          </svg>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.15, y: 1 }}
                          onClick={() => moveHabit(originalIndex, 'down')}
                          disabled={originalIndex === habits.length - 1}
                          className="text-neutral-650 hover:text-neutral-200 disabled:opacity-5 transition-colors leading-none cursor-pointer p-0.5"
                          title="Move Down"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </motion.button>
                      </div>

                      {/* Main habit contents */}
                      <div className="flex-1 min-w-0 z-10 pl-1">
                        <p className="text-sm font-semibold font-mono text-neutral-200 truncate">{habit.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold tracking-wide uppercase ${categoryScheme.text}`}>
                            {habit.category}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono font-medium">{habit.points} pts</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setEditingId(habit.id)
                            setForm({ name: habit.name, category: habit.category.toUpperCase(), points: habit.points })
                            setIsCustomCategory(false)
                            setCustomCategoryText('')
                          }}
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
                            editingId === habit.id
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50'
                              : 'text-neutral-450 hover:text-white bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80'
                          }`}
                        >
                          {editingId === habit.id ? 'Editing' : 'Edit'}
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => deleteHabit(habit.id)}
                          className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg bg-red-950/20 border border-red-900/35 hover:bg-red-950/35 transition-all duration-200 cursor-pointer"
                        >
                          Delete
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {filteredHabits.length === 0 && (
                <FadeIn className="text-center py-16 bg-neutral-900/10 border border-dashed border-neutral-850/50 rounded-2xl">
                  <p className="text-sm text-neutral-500 font-mono mb-2">No habits in this category.</p>
                  <button
                    onClick={() => { setActiveTab('all'); setForm(empty); setEditingId(null) }}
                    className="text-xs text-white underline underline-offset-4 hover:text-neutral-300 font-mono cursor-pointer"
                  >
                    View all habits
                  </button>
                </FadeIn>
              )}
            </div>
          </div>

          {/* Right Column (1/3 width) - Sidebar Console */}
          <div className="space-y-6 lg:sticky lg:top-24">
            
            {/* Unified Form Card */}
            <FadeIn delay={0.05} className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-750 font-mono select-none pointer-events-none">
                [ CONFIG PANEL ]
              </div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">
                {editingId ? 'Edit Habit' : 'New Habit'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest block mb-1.5">Habit Title</label>
                  <input
                    type="text"
                    placeholder="e.g. 4 hours of deep focus"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-neutral-800/80 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none bg-[#0d0d0d] focus:border-cyan-500/50 focus:shadow-[0_0_10px_rgba(6,182,212,0.12)] transition-all duration-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest block mb-1.5">Category</label>
                    <select
                      value={isCustomCategory ? 'ADD_CUSTOM_NEW' : form.category}
                      onChange={e => handleCategoryChange(e.target.value)}
                      className="w-full border border-neutral-800/80 rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none bg-[#0d0d0d] focus:border-cyan-500/50 transition-all duration-300 uppercase font-mono text-xs tracking-wider cursor-pointer"
                    >
                      {categoriesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="ADD_CUSTOM_NEW">+ ADD CUSTOM...</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest block mb-1.5">Points Weight</label>
                    <div className="flex items-center gap-2 border border-neutral-800/80 rounded-xl px-3 bg-[#0d0d0d] focus-within:border-cyan-500/50 focus-within:shadow-[0_0_10px_rgba(6,182,212,0.12)] transition-all duration-300">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={form.points}
                        onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 5 }))}
                        className="w-full text-sm text-neutral-200 outline-none py-2 bg-transparent font-mono"
                      />
                      <span className="text-[11px] text-neutral-600 font-mono">pts</span>
                    </div>
                  </div>
                </div>

                {isCustomCategory && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1.5"
                  >
                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest block mb-1">Custom Category Name</label>
                    <input
                      type="text"
                      placeholder="e.g. COOKING, DESIGN, TRAVEL"
                      value={customCategoryText}
                      onChange={e => setCustomCategoryText(e.target.value.toUpperCase())}
                      className="w-full border border-neutral-800/80 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none bg-[#0d0d0d] focus:border-cyan-500/50 focus:shadow-[0_0_10px_rgba(6,182,212,0.12)] transition-all duration-300 uppercase font-mono text-xs tracking-wider"
                    />
                  </motion.div>
                )}

                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01, filter: 'brightness(1.1)' }}
                    whileTap={{ scale: 0.99 }}
                    onClick={editingId ? () => saveEdit(editingId) : saveNew}
                    disabled={saving || !form.name.trim() || (isCustomCategory && !customCategoryText.trim())}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 text-xs font-bold font-mono uppercase tracking-wider py-2.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Save Habit'}
                  </motion.button>
                  
                  {(editingId || form.name.trim() || isCustomCategory) && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setEditingId(null)
                        setForm(empty)
                        setIsCustomCategory(false)
                        setCustomCategoryText('')
                      }}
                      className="px-4 text-xs font-mono uppercase tracking-wider text-neutral-400 border border-neutral-850 rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </motion.button>
                  )}
                </div>
              </div>
            </FadeIn>

            {/* Points Weight Breakdown Analytics */}
            <FadeIn delay={0.1} className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-[9px] text-neutral-750 font-mono select-none pointer-events-none">
                [ LOAD METRIC ]
              </div>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Points Breakdown</p>
              
              <div className="space-y-4">
                {pointsBreakdown.map(breakdown => {
                  const scheme = getCategoryScheme(breakdown.category);
                  return (
                    <div key={breakdown.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="uppercase text-neutral-450 font-medium">{breakdown.category}</span>
                        <span className="text-neutral-550 font-bold">
                          {breakdown.points} pts ({breakdown.percentage}%)
                        </span>
                      </div>
                      {/* Visual bar */}
                      <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-900">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${breakdown.percentage}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${scheme.bg}`}
                        />
                      </div>
                    </div>
                  );
                })}
                
                {totalPoints === 0 && (
                  <p className="text-xs text-neutral-600 italic font-mono text-center py-2">
                    Add habits to visualize point distribution.
                  </p>
                )}
              </div>
            </FadeIn>

          </div>

        </div>

      </div>
    </div>
  )
}

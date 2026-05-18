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

const categories = ['sleep', 'study', 'health', 'mindset']

const categoryColors: Record<string, string> = {
  sleep:   'text-blue-400 bg-blue-950/60 border border-blue-900/30',
  study:   'text-green-400 bg-green-950/60 border border-green-900/30',
  health:  'text-orange-400 bg-orange-950/60 border border-orange-900/30',
  mindset: 'text-purple-400 bg-purple-950/60 border border-purple-900/30',
}

const categoryThemeColors: Record<string, string> = {
  sleep:   'bg-blue-500',
  study:   'bg-green-500',
  health:  'bg-orange-500',
  mindset: 'bg-purple-500',
}

const empty = { name: '', category: 'study', points: 10 }

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

  async function saveNew() {
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('habits').insert({
      user_id: user.id,
      name: form.name.trim(),
      category: form.category,
      points: form.points,
      sort_order: habits.length + 1,
    })

    setForm(empty)
    setSaving(false)
    load()
  }

  async function saveEdit(id: string) {
    if (!form.name.trim()) return
    setSaving(true)

    await supabase.from('habits').update({
      name: form.name.trim(),
      category: form.category,
      points: form.points,
    }).eq('id', id)

    setEditingId(null)
    setForm(empty)
    setSaving(false)
    load()
  }

  async function deleteHabit(id: string) {
    await supabase.from('habits').delete().eq('id', id)
    // Reset form if we were editing this specific habit
    if (editingId === id) {
      setEditingId(null)
      setForm(empty)
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
  
  // Calculate points breakdown per category
  const pointsBreakdown = categories.map(cat => {
    const total = habits.filter(h => h.category === cat).reduce((s, h) => s + h.points, 0)
    const percentage = totalPoints > 0 ? Math.round((total / totalPoints) * 100) : 0
    return { category: cat, points: total, percentage }
  })

  // Filter habits based on active tab
  const filteredHabits = habits.filter(h => activeTab === 'all' || h.category === activeTab)

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
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans">
      <main className="flex-1 max-w-5xl w-full mx-auto px-8 py-10">
        
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
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-900/60">
                {['all', ...categories].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative px-2.5 py-1 text-[10px] uppercase font-mono tracking-wider rounded-md transition-colors duration-200 ${
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
                  
                  return (
                    <motion.div
                      key={habit.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-center gap-4 px-4 py-3 bg-neutral-900/20 border rounded-2xl transition-all duration-300 group ${
                        editingId === habit.id 
                          ? 'border-neutral-700 bg-neutral-900/50 shadow-inner' 
                          : 'border-neutral-800/40 hover:border-neutral-800 hover:bg-neutral-900/40'
                      }`}
                    >
                      {/* Sort arrows */}
                      <div className="flex flex-col gap-0.5">
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          onClick={() => moveHabit(originalIndex, 'up')}
                          disabled={originalIndex === 0}
                          className="text-neutral-700 hover:text-neutral-300 disabled:opacity-10 leading-none text-xs"
                          title="Move Up"
                        >
                          ▲
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          onClick={() => moveHabit(originalIndex, 'down')}
                          disabled={originalIndex === habits.length - 1}
                          className="text-neutral-700 hover:text-neutral-300 disabled:opacity-10 leading-none text-xs"
                          title="Move Down"
                        >
                          ▼
                        </motion.button>
                      </div>

                      {/* Main habit contents */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">{habit.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium tracking-wide uppercase ${categoryColors[habit.category]}`}>
                            {habit.category}
                          </span>
                          <span className="text-[10px] text-neutral-600 font-mono">{habit.points} pts</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setEditingId(habit.id)
                            setForm({ name: habit.name, category: habit.category, points: habit.points })
                          }}
                          className={`text-xs font-mono px-2.5 py-1 rounded-lg transition-colors ${
                            editingId === habit.id
                              ? 'bg-neutral-800 text-white'
                              : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          {editingId === habit.id ? 'Editing' : 'Edit'}
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => deleteHabit(habit.id)}
                          className="text-xs font-mono text-red-500 hover:text-red-300 px-2.5 py-1 rounded-lg hover:bg-red-950/20 transition-colors"
                        >
                          Delete
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {filteredHabits.length === 0 && (
                <FadeIn className="text-center py-16 bg-neutral-900/10 border border-dashed border-neutral-800/40 rounded-2xl">
                  <p className="text-sm text-neutral-500 font-mono mb-2">No habits in this category.</p>
                  <button
                    onClick={() => { setActiveTab('all'); setForm(empty); setEditingId(null) }}
                    className="text-xs text-white underline underline-offset-4 hover:text-neutral-300 font-mono"
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
            <FadeIn delay={0.05} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">
                {editingId ? 'Edit Habit' : 'New Habit'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Habit Title</label>
                  <input
                    type="text"
                    placeholder="e.g. 4 hours of deep focus"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 outline-none bg-[#0a0a0a] focus:border-neutral-600 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none bg-[#0a0a0a] focus:border-neutral-600 transition-colors uppercase font-mono text-xs tracking-wider"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest block mb-1.5">Points Weight</label>
                    <div className="flex items-center gap-2 border border-neutral-800 rounded-xl px-3 bg-[#0a0a0a] focus-within:border-neutral-600 transition-colors">
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

                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={editingId ? () => saveEdit(editingId) : saveNew}
                    disabled={saving || !form.name.trim()}
                    className="flex-1 bg-white text-black text-xs font-semibold py-2.5 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Save Habit'}
                  </motion.button>
                  
                  {(editingId || form.name.trim()) && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setEditingId(null)
                        setForm(empty)
                      }}
                      className="px-4 text-xs font-mono text-neutral-500 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                      Cancel
                    </motion.button>
                  )}
                </div>
              </div>
            </FadeIn>

            {/* Points Weight Breakdown Analytics */}
            <FadeIn delay={0.1} className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5">
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-widest mb-4">Points Breakdown</p>
              
              <div className="space-y-4">
                {pointsBreakdown.map(breakdown => (
                  <div key={breakdown.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="uppercase text-neutral-400">{breakdown.category}</span>
                      <span className="text-neutral-500">
                        {breakdown.points} pts ({breakdown.percentage}%)
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full bg-neutral-950 rounded-full h-1 overflow-hidden border border-neutral-900">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${breakdown.percentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${categoryThemeColors[breakdown.category]}`}
                      />
                    </div>
                  </div>
                ))}
                
                {totalPoints === 0 && (
                  <p className="text-xs text-neutral-600 italic font-mono text-center py-2">
                    Add habits to visualize point weight matrix.
                  </p>
                )}
              </div>
            </FadeIn>

          </div>

        </div>

      </main>
    </div>
  )
}

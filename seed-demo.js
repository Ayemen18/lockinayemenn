const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Manually parse .env.local variables to prevent dependency bloat
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  envContent.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  })
} catch (err) {
  console.warn('⚠️ Warning: Could not read .env.local file directly.')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Supabase environment variables not found in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const EMAIL = 'test@example.com'
const PASSWORD = 'Password@123'

async function seed() {
  console.log(`\n🚀 Initializing LockIn Seeder for ${EMAIL}...`)

  let userId = ''

  // 1. Sign Up the user. If they already exist, sign in instead.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  })

  if (signUpError) {
    if (signUpError.message.includes('already registered') || signUpError.status === 400) {
      console.log('ℹ User already registered. Signing in...')
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
      })

      if (signInError) {
        console.error('❌ Sign-in failed:', signInError.message)
        process.exit(1)
      }
      userId = signInData.user.id
      console.log('✓ Signed in successfully. User ID:', userId)
    } else {
      console.error('❌ Sign-up failed:', signUpError.message)
      process.exit(1)
    }
  } else {
    userId = signUpData.user?.id || ''
    console.log('✓ Account created successfully! User ID:', userId)
  }

  if (!userId) {
    console.error('❌ Could not retrieve user ID.')
    process.exit(1)
  }

  // Update user metadata so they have a premium display name and targeting guidelines
  await supabase.auth.updateUser({
    data: {
      display_name: 'Ayemen',
      bio: 'Building LockIn // High-Performance Analytics',
      target_daily_score: 80,
      target_sleep: 8.0,
      target_study: 5.0
    }
  })
  console.log('✓ User profile metadata updated (Display Name: Ayemen).')

  // 2. Wipe clean any old records to start completely fresh
  console.log('\n🧹 Clearing any old data for this user...')
  await supabase.from('daily_logs').delete().eq('user_id', userId)
  await supabase.from('habits').delete().eq('user_id', userId)
  console.log('✓ Clean slate achieved.')

  // 3. Seed 12 High-Performance habits (totaling exactly 100 points)
  console.log('\n🌱 Seeding 12 High-Performance Habits...')
  const habitsToCreate = [
    { name: 'Wake up at 6:30 AM', category: 'sleep', points: 10, sort_order: 1 },
    { name: 'Morning study session', category: 'study', points: 10, sort_order: 2 },
    { name: 'Cold shower', category: 'health', points: 5, sort_order: 3 },
    { name: '5 hrs of study', category: 'study', points: 20, sort_order: 4 },
    { name: 'Workout 15 min', category: 'health', points: 10, sort_order: 5 },
    { name: 'Read 5 pages', category: 'mindset', points: 5, sort_order: 6 },
    { name: 'Eat 80% no junk', category: 'health', points: 10, sort_order: 7 },
    { name: '2L of water', category: 'health', points: 5, sort_order: 8 },
    { name: 'Clean environment', category: 'mindset', points: 5, sort_order: 9 },
    { name: 'Skin and hair care', category: 'health', points: 5, sort_order: 10 },
    { name: 'Plan next day', category: 'mindset', points: 5, sort_order: 11 },
    { name: 'Journaling', category: 'mindset', points: 5, sort_order: 12 },
  ]

  const { data: createdHabits, error: habitsError } = await supabase
    .from('habits')
    .insert(habitsToCreate.map(h => ({ ...h, user_id: userId })))
    .select('*')

  if (habitsError) {
    console.error('❌ Failed to insert habits:', habitsError.message)
    process.exit(1)
  }

  // Sort habits by sort_order so we can index them reliably
  createdHabits.sort((a, b) => a.sort_order - b.sort_order)
  console.log(`✓ successfully seeded ${createdHabits.length} habits.`)

  // 4. Generate 30 days of highly polished daily logs
  console.log('\n📊 Generating 30 days of historical discipline analytics...')
  
  const reflections = [
    "Elite focus block today. Completed all study modules early, cold shower set the mental tone.",
    "Decent day. Missed the 5h study target but hit the gym hard and kept diet perfectly clean.",
    "Very high productivity day. Sleep was quality, woke up right at 6:30 and went straight to code.",
    "Kept consistency alive. Hydration was high. Need to push study hours slightly higher tomorrow.",
    "Decent recovery. Had a slow morning but saved the day with a solid evening deep work sprint.",
    "Outstanding execution. Fully locked in. Zero junk food, 5.5 hours logged. Pure focus.",
    "Decent, but energy dropped in the afternoon. Need to improve sleep hygiene tonight.",
    "Hit a perfect 100% score! The momentum is building. Feeling extremely sharp.",
    "Fell short of study goals today but maintained sleep and hydration habits. We adjust.",
    "Super productive study block. Read a lot of system architecture docs. Clean setup.",
  ]

  const logsToInsert = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]

    // We want a mix of realistic days:
    // - i = 0 (today): 90% completed
    // - i = 1 (yesterday): 100% perfect
    // - Some days have 0% scores to show realistic breaks
    // - Most days are high scores (70% - 95%)

    let completedHabitIds = []
    let score = 0
    let studyHours = 0
    let sleepTime = "07:30"
    let reflection = ""

    if (i === 15 || i === 22) {
      // 0% days to show breaks in heatmaps & streak resets
      score = 0
      studyHours = 0
      sleepTime = "06:00"
      reflection = "Exhausted today. Taking a complete reset day to recharge mentally. Back at it tomorrow."
    } else {
      // Standard days
      let selectedHabits = []
      
      if (i === 1 || i === 7 || i === 14) {
        // Perfect 100% Days
        selectedHabits = [...createdHabits]
        studyHours = 6.0
        sleepTime = "08:15"
        reflection = "100% perfect execution. Woke up on time, studied 6 hours, worked out, and logged reflections. Locked in."
      } else {
        // High/medium consistency days
        // Keep the high-value habits most of the time
        selectedHabits = createdHabits.filter((_, idx) => {
          // Study hours 5h (idx 3) is 20 points, make it 75% likely
          if (idx === 3) return Math.random() > 0.3
          // Wake up 6:30 AM (idx 0) is 10 points
          if (idx === 0) return Math.random() > 0.25
          // General habits are 85% likely
          return Math.random() > 0.15
        })

        studyHours = selectedHabits.some(h => h.name.includes('5 hrs')) 
          ? parseFloat((5 + Math.random() * 1.5).toFixed(1))
          : parseFloat((2 + Math.random() * 2.5).toFixed(1))

        sleepTime = `0${7 + Math.floor(Math.random() * 2)}:${['00','15','30','45'][Math.floor(Math.random() * 4)]}`
        reflection = reflections[i % reflections.length]
      }

      completedHabitIds = selectedHabits.map(h => h.id)
      score = selectedHabits.reduce((sum, h) => sum + h.points, 0)
    }

    logsToInsert.push({
      user_id: userId,
      date: dateStr,
      completed_habit_ids: completedHabitIds,
      total_points: 100,
      earned_points: score,
      score: score,
      study_hours: score > 0 ? studyHours : null,
      sleep_time: score > 0 ? sleepTime : null,
      reflection: reflection
    })
  }

  // Insert all daily logs
  const { error: logsError } = await supabase
    .from('daily_logs')
    .insert(logsToInsert)

  if (logsError) {
    console.error('❌ Failed to insert daily logs:', logsError.message)
    process.exit(1)
  }

  console.log(`✓ successfully generated 30 daily logs with realistic scores and reflections.`)
  console.log('\n👑 Seeding Complete! LockIn Demo Account is fully populated and ready for LinkedIn!');
  console.log('========================================================================')
  console.log(`📧 Email:    ${EMAIL}`)
  console.log(`🔑 Password: ${PASSWORD}`)
  console.log('========================================================================')
}

seed()

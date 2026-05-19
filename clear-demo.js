const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

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

async function clearDemo() {
  console.log(`\n🧹 Clearing Demo data for ${EMAIL}...`)
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })

  if (error) {
    console.error('❌ Sign-in failed:', error.message)
    process.exit(1)
  }

  const userId = data.user.id
  console.log('✓ Signed in successfully. User ID:', userId)

  const { error: logsError } = await supabase.from('daily_logs').delete().eq('user_id', userId)
  if (logsError) {
    console.error('❌ Error clearing daily logs:', logsError.message)
  } else {
    console.log('✓ Daily logs cleared.')
  }
  
  const { error: habitsError } = await supabase.from('habits').delete().eq('user_id', userId)
  if (habitsError) {
    console.error('❌ Error clearing habits:', habitsError.message)
  } else {
    console.log('✓ Habits cleared.')
  }

  console.log('✓ Demo data cleared completely!')
}

clearDemo()

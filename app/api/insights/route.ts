import OpenAI from 'openai'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (err) {
            console.error('Error in Supabase server client cookie setter:', err)
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('date, score, study_hours, sleep_time, reflection, earned_points, total_points')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(14)

  if (!logs || logs.length < 3) {
    return NextResponse.json({ error: 'Need at least 3 days of data' }, { status: 400 })
  }

  const { data: habits } = await supabase
    .from('habits')
    .select('name, category, points')
    .eq('user_id', user.id)
    .order('sort_order')

  const weekStart = logs[logs.length - 1].date
  const weekEnd = logs[0].date
  const avgScore = Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)

  // Use maybeSingle to prevent PGRST116 single() crash on empty selection
  const { data: existing } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ report: existing.report, cached: true })
  }

  const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })

  const prompt = `You are a personal discipline coach analyzing someone's habit tracking data. Be direct, specific, and motivating — not generic.

Here are their habits and point values:
${habits?.map(h => `- ${h.name} (${h.category}, ${h.points}pts)`).join('\n')}

Here are their last ${logs.length} days of data (most recent first):
${logs.map(l => `
Date: ${l.date}
Score: ${l.score}%
Study hours: ${l.study_hours || 'not logged'}
Sleep time: ${l.sleep_time || 'not logged'}
Reflection: "${l.reflection || 'none'}"
`).join('---')}

Write a structured weekly coach report with exactly these sections:

**PERFORMANCE SUMMARY**
2-3 sentences on overall performance. Be direct about whether this was a good or bad stretch.

**WHAT'S WORKING**
2-3 specific patterns from the data that are going well. Reference actual numbers.

**BIGGEST BLOCKERS**
2-3 specific things hurting the score. Reference actual dates or patterns.

**THIS WEEK'S FOCUS**
Exactly 3 action items, numbered, ultra-specific. Not generic advice — based on their actual data. Each one sentence.

**COACH'S NOTE**
1-2 sentences. Honest and direct. Something they need to hear.

Keep the whole report under 400 words. No filler. Reference their actual data throughout.`

  const completion = await client.chat.completions.create({
    model: 'grok-3',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const report = completion.choices[0].message.content || ''

  await supabase.from('insights').upsert({
    user_id: user.id,
    week_start: weekStart,
    week_end: weekEnd,
    avg_score: avgScore,
    report,
  }, { onConflict: 'user_id,week_start' })

  return NextResponse.json({ report, cached: false })
}

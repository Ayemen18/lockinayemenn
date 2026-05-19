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
            console.error('Error in supabase cookie setter:', err)
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get last 14 days of logs
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('date, score, study_hours, sleep_time, reflection, earned_points, total_points')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(14)

  if (!logs || logs.length < 3) {
    return NextResponse.json({ error: 'Need at least 3 days of data' }, { status: 400 })
  }

  // Get habits for context
  const { data: habits } = await supabase
    .from('habits')
    .select('name, category, points')
    .eq('user_id', user.id)
    .order('sort_order')

  const weekStart = logs[logs.length - 1].date
  const weekEnd = logs[0].date
  const avgScore = Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)

  // Check if already generated this week
  const { data: existing } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ report: existing.report, cached: true })
  }

  if (!process.env.GROK_API_KEY) {
    console.error('GROK_API_KEY is not configured in env variables.')
    return NextResponse.json({ error: 'AI Coach API is currently unavailable.' }, { status: 500 })
  }

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

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Grok API Response Error:', errorText)
      return NextResponse.json({ error: 'Failed to generate insights from AI coach.' }, { status: 500 })
    }

    const data = await response.json()
    const report = data.choices?.[0]?.message?.content || ''

    if (!report) {
      return NextResponse.json({ error: 'Coach failed to compile the report.' }, { status: 500 })
    }

    // Save to Supabase
    const { error: upsertError } = await supabase.from('insights').upsert({
      user_id: user.id,
      week_start: weekStart,
      week_end: weekEnd,
      avg_score: avgScore,
      report,
    }, { onConflict: 'user_id,week_start' })

    if (upsertError) {
      console.error('Error saving insights to Supabase:', upsertError)
    }

    return NextResponse.json({ report, cached: false })
  } catch (err) {
    console.error('Exception calling Grok API:', err)
    return NextResponse.json({ error: 'Internal server error occurred.' }, { status: 500 })
  }
}

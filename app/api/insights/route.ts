import OpenAI from 'openai'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
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
              console.error('Supabase server client cookie setter error:', err)
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('date, score, study_hours, sleep_time, reflection, earned_points, total_points')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(14)

    if (logsError) {
      console.error('Supabase daily_logs query failed:', logsError)
      return NextResponse.json({ error: `Database Error (daily_logs): ${logsError.message}` }, { status: 500 })
    }

    if (!logs || logs.length < 3) {
      return NextResponse.json({ error: 'Need at least 3 days of data' }, { status: 400 })
    }

    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('name, category, points')
      .eq('user_id', user.id)
      .order('sort_order')

    if (habitsError) {
      console.error('Supabase habits query failed:', habitsError)
      return NextResponse.json({ error: `Database Error (habits): ${habitsError.message}` }, { status: 500 })
    }

    const weekStart = logs[logs.length - 1].date
    const weekEnd = logs[0].date
    const avgScore = Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)

    // Using maybeSingle to prevent PGRST116 single() crash on empty selection
    let existing = null
    try {
      const { data, error: existingError } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle()
      
      if (existingError) {
        console.warn('Insights table does not exist or select failed:', existingError)
      } else {
        existing = data
      }
    } catch (err) {
      console.warn('Supabase existing insights query exception:', err)
    }

    if (existing) {
      return NextResponse.json({ report: existing.report, cached: true })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not defined in env variables.')
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY is missing in your Vercel or local environment variables.' 
      }, { status: 400 })
    }

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })

    const prompt = `You are a personal discipline coach. Analyze this data and write a complete coach report. Be direct and specific.

Habits tracked:
${habits?.map(h => `- ${h.name} (${h.category}, ${h.points}pts)`).join('\n')}

Last ${logs.length} days (newest first):
${logs.map(l => `${l.date}: ${l.score}% | study: ${l.study_hours || '?'}h | sleep: ${l.sleep_time || '?'} | note: "${l.reflection || 'none'}"`).join('\n')}

Write exactly these 5 sections, each with 2-3 sentences or items:

**PERFORMANCE SUMMARY**
Overall assessment of this period.

**WHAT'S WORKING**
2-3 specific patterns going well with actual numbers.

**BIGGEST BLOCKERS**
2-3 things hurting the score with specific dates/patterns.

**THIS WEEK'S FOCUS**
1. First action item
2. Second action item  
3. Third action item

**COACH'S NOTE**
One honest thing they need to hear.`

    let report = ''
    try {
      const completion = await client.chat.completions.create({
        model: 'gemini-2.5-flash',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      
      const choice = completion.choices[0]
      report = choice.message.content || ''

      // If response was cut off, don't save truncated report
      if (choice.finish_reason === 'length') {
        return NextResponse.json({ 
          error: 'Response was too long and got cut off. Try again.' 
        }, { status: 500 })
      }

      if (!report || report.length < 100) {
        return NextResponse.json({ 
          error: 'Empty or too short response from AI. Try again.' 
        }, { status: 500 })
      }
    } catch (apiErr: any) {
      console.error('Google Gemini API call failed:', apiErr)
      return NextResponse.json({ 
        error: `Gemini API Error: ${apiErr.message || apiErr}` 
      }, { status: 502 })
    }

    const { error: upsertError } = await supabase.from('insights').upsert({
      user_id: user.id,
      week_start: weekStart,
      week_end: weekEnd,
      avg_score: avgScore,
      report,
    }, { onConflict: 'user_id,week_start' })

    if (upsertError) {
      console.error('Error saving insights to database:', upsertError)
      // Return the report even if save fails, so the user still gets the AI analysis on screen!
      return NextResponse.json({ 
        report, 
        warning: `Database save failed: ${upsertError.message}`, 
        cached: false 
      })
    }

    return NextResponse.json({ report, cached: false })
  } catch (err: any) {
    console.error('Insights API Route uncaught exception:', err)
    return NextResponse.json({ 
      error: `Internal Server Error: ${err.message || err}` 
    }, { status: 500 })
  }
}

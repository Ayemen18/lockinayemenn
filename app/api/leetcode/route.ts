import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')

  if (!username) {
    return NextResponse.json({ error: 'No username' }, { status: 400 })
  }

  try {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            ranking
          }
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
          userCalendar {
            streak
            totalActiveDays
          }
        }
        recentAcSubmissionList(username: $username, limit: 20) {
          title
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }
    `

    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
      },
      body: JSON.stringify({ query, variables: { username } }),
    })

    const data = await res.json()

    if (!data.data?.matchedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = data.data.matchedUser
    const recentSubmissions = data.data.recentAcSubmissionList || []

    // Filter problems solved in the last 24 hours (robust timezone-immune definition of "today")
    const todayTimestamp = Math.floor(Date.now() / 1000) - 24 * 60 * 60

    const todaySolved = recentSubmissions.filter(
      (s: any) => parseInt(s.timestamp) >= todayTimestamp
    )

    // Remove duplicates (same problem solved multiple times)
    const uniqueTodaySolved = Array.from(
      new Map(todaySolved.map((s: any) => [s.titleSlug, s])).values()
    )

    const stats = user.submitStats.acSubmissionNum
    const easy = stats.find((s: any) => s.difficulty === 'Easy')?.count || 0
    const medium = stats.find((s: any) => s.difficulty === 'Medium')?.count || 0
    const hard = stats.find((s: any) => s.difficulty === 'Hard')?.count || 0
    const total = stats.find((s: any) => s.difficulty === 'All')?.count || 0

    return NextResponse.json({
      username: user.username,
      ranking: user.profile.ranking,
      streak: user.userCalendar?.streak || 0,
      totalActiveDays: user.userCalendar?.totalActiveDays || 0,
      totalSolved: total,
      easy,
      medium,
      hard,
      todaySolvedCount: uniqueTodaySolved.length,
      todayProblems: uniqueTodaySolved.map((s: any) => s.title),
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch LeetCode data' }, { status: 500 })
  }
}

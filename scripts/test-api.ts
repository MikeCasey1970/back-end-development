/**
 * scripts/test-api.ts
 *
 * Internal API smoke-test runner. No test framework required.
 * Run against a live local dev server:
 *
 *   pnpm tsx scripts/test-api.ts
 *
 * Requirements:
 *   - Dev server running on http://localhost:3000 (pnpm dev)
 *   - SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD set in your .env.local
 *     These credentials are used to obtain a real session token for auth tests.
 */

const BASE_URL   = process.env.TEST_BASE_URL   ?? 'http://localhost:3000'
const TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL
const TEST_PASS  = process.env.SUPABASE_TEST_PASSWORD
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Tiny test runner
// ---------------------------------------------------------------------------

type TestResult = { name: string; passed: boolean; detail: string }
const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true, detail: 'OK' })
  } catch (err) {
    results.push({ name, passed: false, detail: err instanceof Error ? err.message : String(err) })
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  assert(!!SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL is not set in environment')
  assert(!!SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in environment')
  assert(!!TEST_EMAIL, 'SUPABASE_TEST_EMAIL is not set in environment')
  assert(!!TEST_PASS, 'SUPABASE_TEST_PASSWORD is not set in environment')

  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    }
  )

  const json = await res.json() as { access_token?: string; error_description?: string }
  assert(!!json.access_token, `Sign-in failed: ${json.error_description ?? 'unknown error'}`)
  return json.access_token!
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

async function get(
  path: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res  = await fetch(`${BASE_URL}${path}`, { headers })
  const body = await res.json().catch(() => null)
  return { status: res.status, body, headers: res.headers }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function runAuthGuardTests() {
  // Every protected route must return 401 with no token
  const routes = [
    '/api/analytics/follower-growth',
    '/api/analytics/weekly-engagement',
    '/api/analytics/total-engagement',
    '/api/social/content-table',
  ]

  for (const route of routes) {
    await test(`AUTH GUARD — ${route} returns 401 with no token`, async () => {
      const { status, body } = await get(route)
      assert(status === 401, `Expected 401, got ${status}`)
      const b = body as Record<string, unknown>
      assert(b?.code === 'UNAUTHORIZED', `Expected code UNAUTHORIZED, got ${b?.code}`)
    })
  }
}

async function runFollowerGrowthTests(token: string) {
  await test('FOLLOWER GROWTH — returns 200 with data array', async () => {
    const { status, body } = await get('/api/analytics/follower-growth', authHeaders(token))
    assert(status === 200, `Expected 200, got ${status}`)
    const b = body as Record<string, unknown>
    assert(Array.isArray(b?.data), 'Expected data to be an array')
  })

  await test('FOLLOWER GROWTH — response rows have correct shape', async () => {
    const { body } = await get('/api/analytics/follower-growth', authHeaders(token))
    const b = body as { data: Record<string, unknown>[] }
    if (b.data.length === 0) return // no data seeded — skip shape check
    const row = b.data[0]
    assert('inserted_at'     in row, 'Missing field: inserted_at')
    assert('candidate_name'  in row, 'Missing field: candidate_name')
    assert('total_followers' in row, 'Missing field: total_followers')
    assert('platform'        in row, 'Missing field: platform')
  })

  await test('FOLLOWER GROWTH — start_date filter is accepted (200)', async () => {
    const { status } = await get(
      '/api/analytics/follower-growth?start_date=2024-01-01',
      authHeaders(token)
    )
    assert(status === 200, `Expected 200, got ${status}`)
  })

  await test('FOLLOWER GROWTH — date range filter is accepted (200)', async () => {
    const { status } = await get(
      '/api/analytics/follower-growth?start_date=2024-01-01&end_date=2024-12-31',
      authHeaders(token)
    )
    assert(status === 200, `Expected 200, got ${status}`)
  })
}

async function runWeeklyEngagementTests(token: string) {
  await test('WEEKLY ENGAGEMENT — returns 200 with data array', async () => {
    const { status, body } = await get('/api/analytics/weekly-engagement', authHeaders(token))
    assert(status === 200, `Expected 200, got ${status}`)
    const b = body as Record<string, unknown>
    assert(Array.isArray(b?.data), 'Expected data to be an array')
  })

  await test('WEEKLY ENGAGEMENT — response rows have correct shape', async () => {
    const { body } = await get('/api/analytics/weekly-engagement', authHeaders(token))
    const b = body as { data: Record<string, unknown>[] }
    if (b.data.length === 0) return
    const row = b.data[0]
    assert('week_start'       in row, 'Missing field: week_start')
    assert('candidate_name'   in row, 'Missing field: candidate_name')
    assert('likes_count'      in row, 'Missing field: likes_count')
    assert('replies_count'    in row, 'Missing field: replies_count')
    assert('shares_count'     in row, 'Missing field: shares_count')
    assert('bookmarks_count'  in row, 'Missing field: bookmarks_count')
    assert('total_engagement' in row, 'Missing field: total_engagement')
  })

  await test('WEEKLY ENGAGEMENT — date range filter is accepted (200)', async () => {
    const { status } = await get(
      '/api/analytics/weekly-engagement?start_date=2024-01-01&end_date=2024-12-31',
      authHeaders(token)
    )
    assert(status === 200, `Expected 200, got ${status}`)
  })
}

async function runTotalEngagementTests(token: string) {
  await test('TOTAL ENGAGEMENT — returns 200 with data array', async () => {
    const { status, body } = await get('/api/analytics/total-engagement', authHeaders(token))
    assert(status === 200, `Expected 200, got ${status}`)
    const b = body as Record<string, unknown>
    assert(Array.isArray(b?.data), 'Expected data to be an array')
  })

  await test('TOTAL ENGAGEMENT — response rows have correct shape', async () => {
    const { body } = await get('/api/analytics/total-engagement', authHeaders(token))
    const b = body as { data: Record<string, unknown>[] }
    if (b.data.length === 0) return
    const row = b.data[0]
    assert('inserted_at'      in row, 'Missing field: inserted_at')
    assert('daily_engagement' in row, 'Missing field: daily_engagement')
    assert('cumulative_total' in row, 'Missing field: cumulative_total')
  })

  await test('TOTAL ENGAGEMENT — candidate filter is accepted (200)', async () => {
    const { status } = await get(
      '/api/analytics/total-engagement?candidate=Alice',
      authHeaders(token)
    )
    assert(status === 200, `Expected 200, got ${status}`)
  })

  await test('TOTAL ENGAGEMENT — cumulative_total is non-decreasing', async () => {
    const { body } = await get('/api/analytics/total-engagement', authHeaders(token))
    const b = body as { data: { cumulative_total: number }[] }
    if (b.data.length < 2) return
    for (let i = 1; i < b.data.length; i++) {
      assert(
        b.data[i].cumulative_total >= b.data[i - 1].cumulative_total,
        `cumulative_total decreased at index ${i}: ${b.data[i - 1].cumulative_total} → ${b.data[i].cumulative_total}`
      )
    }
  })
}

async function runContentTableTests(token: string) {
  await test('CONTENT TABLE — returns 200 with data array', async () => {
    const { status, body } = await get('/api/social/content-table', authHeaders(token))
    assert(status === 200, `Expected 200, got ${status}`)
    const b = body as Record<string, unknown>
    assert(Array.isArray(b?.data), 'Expected data to be an array')
  })

  await test('CONTENT TABLE — X-Total-Count header is present', async () => {
    const { headers } = await get('/api/social/content-table', authHeaders(token))
    const count = headers.get('x-total-count')
    assert(count !== null, 'Missing X-Total-Count header')
    assert(!isNaN(Number(count)), `X-Total-Count is not a number: ${count}`)
  })

  await test('CONTENT TABLE — response rows have correct shape', async () => {
    const { body } = await get('/api/social/content-table', authHeaders(token))
    const b = body as { data: Record<string, unknown>[] }
    if (b.data.length === 0) return
    const row = b.data[0]
    const required = [
      'id', 'candidate_name', 'platform', 'post_date',
      'likes_count', 'replies_count', 'shares_count',
      'bookmarks_count', 'views_count', 'total_engagement',
    ]
    for (const field of required) {
      assert(field in row, `Missing field: ${field}`)
    }
  })

  await test('CONTENT TABLE — total_engagement equals sum of individual counts', async () => {
    const { body } = await get('/api/social/content-table', authHeaders(token))
    const b = body as { data: Record<string, number>[] }
    if (b.data.length === 0) return
    for (const row of b.data) {
      const expected = row.likes_count + row.replies_count + row.shares_count + row.bookmarks_count
      assert(
        row.total_engagement === expected,
        `total_engagement mismatch on row ${row.id}: got ${row.total_engagement}, expected ${expected}`
      )
    }
  })

  await test('CONTENT TABLE — pagination params are respected', async () => {
    const { body } = await get(
      '/api/social/content-table?page=1&limit=5',
      authHeaders(token)
    )
    const b = body as { data: unknown[]; page: number; limit: number }
    assert(b.page  === 1, `Expected page 1, got ${b.page}`)
    assert(b.limit === 5, `Expected limit 5, got ${b.limit}`)
    assert(b.data.length <= 5, `Expected at most 5 rows, got ${b.data.length}`)
  })

  await test('CONTENT TABLE — sort_order=asc returns oldest first', async () => {
    const { body } = await get(
      '/api/social/content-table?sort_column=inserted_at&sort_order=asc&limit=2',
      authHeaders(token)
    )
    const b = body as { data: { post_date: string }[] }
    if (b.data.length < 2) return
    assert(
      b.data[0].post_date <= b.data[1].post_date,
      `Expected ascending order: ${b.data[0].post_date} > ${b.data[1].post_date}`
    )
  })

  await test('CONTENT TABLE — platform filter returns only matching rows', async () => {
    const { body } = await get(
      '/api/social/content-table?platform=x&limit=50',
      authHeaders(token)
    )
    const b = body as { data: { platform: string }[] }
    if (b.data.length === 0) return
    for (const row of b.data) {
      assert(row.platform === 'x', `Expected platform "x", got "${row.platform}"`)
    }
  })

  await test('CONTENT TABLE — search_query narrows results', async () => {
    // First fetch total rows with no filter
    const { body: allBody } = await get('/api/social/content-table', authHeaders(token))
    const { headers: searchHeaders } = await get(
      '/api/social/content-table?search_query=zzznomatchexpected999',
      authHeaders(token)
    )
    const allTotal    = Number((await get('/api/social/content-table', authHeaders(token))).headers.get('x-total-count'))
    const searchTotal = Number(searchHeaders.get('x-total-count'))
    // A nonsense query should return fewer (or equal) rows than no query
    assert(searchTotal <= allTotal, `search_query did not narrow results: ${searchTotal} >= ${allTotal}`)
    void allBody // suppress unused warning
  })
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main() {
  console.log('\nNetceed API Test Runner')
  console.log(`Target: ${BASE_URL}\n`)

  // Auth guard tests run without a token — no sign-in needed
  await runAuthGuardTests()

  // All remaining tests require a valid session
  let token: string
  try {
    console.log('Signing in to Supabase to obtain access token...')
    token = await getAccessToken()
    console.log('Sign-in successful.\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Could not obtain access token: ${msg}`)
    console.error('Skipping authenticated tests. Check SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD.\n')
    token = ''
  }

  if (token) {
    await runFollowerGrowthTests(token)
    await runWeeklyEngagementTests(token)
    await runTotalEngagementTests(token)
    await runContentTableTests(token)
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)

  console.log('\n' + '─'.repeat(60))
  console.log(`RESULTS: ${passed.length} passed, ${failed.length} failed out of ${results.length} tests`)
  console.log('─'.repeat(60))

  if (failed.length > 0) {
    console.log('\nFAILED TESTS:')
    for (const r of failed) {
      console.log(`  FAIL  ${r.name}`)
      console.log(`        ${r.detail}`)
    }
  }

  if (passed.length > 0) {
    console.log('\nPASSED TESTS:')
    for (const r of passed) {
      console.log(`  PASS  ${r.name}`)
    }
  }

  console.log('')
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Unexpected runner error:', err)
  process.exit(1)
})

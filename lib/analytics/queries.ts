import { createClient, getClientId } from '@/lib/supabase/server'
import type {
  ContentTableParams,
  ContentTableRow,
  CumulativeEngagementRow,
  FollowerGrowthRow,
  FollowerMetricsParams,
  FollowerMetricsRow,
  PaginatedResponse,
  PostsParams,
  PostsRow,
  WeeklyEngagementRow,
} from '@/types/analytics'

// ---------------------------------------------------------------------------
// Follower Growth
// Fetches time-series follower counts from social.candidate_follower_metrics.
// RLS enforces client_id isolation automatically.
// ---------------------------------------------------------------------------

export async function getFollowerGrowth(
  startDate?: string,
  endDate?: string
): Promise<FollowerGrowthRow[]> {
  const supabase = await createClient()

  let query = supabase
    .schema('social')
    .from('candidate_follower_metrics')
    .select('inserted_at, candidate_name, total_followers')
    .order('inserted_at', { ascending: true })

  if (startDate) query = query.gte('inserted_at', startDate)
  if (endDate)   query = query.lte('inserted_at', endDate)

  const { data, error } = await query

  if (error) throw new Error(`follower-growth query failed: ${error.message}`)

  return (data ?? []) as FollowerGrowthRow[]
}

// ---------------------------------------------------------------------------
// Weekly Engagement
// Groups social_media_content by ISO week (Monday) and candidate, summing
// all four engagement signals. Aggregation is done in Postgres via .rpc().
// RLS enforces client_id isolation automatically.
// ---------------------------------------------------------------------------

export async function getWeeklyEngagement(
  startDate?: string,
  endDate?: string
): Promise<WeeklyEngagementRow[]> {
  const supabase  = await createClient()
  const clientId  = await getClientId()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('social')
    .rpc('get_weekly_engagement', {
      p_client_id:  clientId,
      p_start_date: startDate ?? null,
      p_end_date:   endDate   ?? null,
    })

  if (error) throw new Error(`weekly-engagement query failed: ${error.message}`)

  return (data ?? []) as WeeklyEngagementRow[]
}

// ---------------------------------------------------------------------------
// Cumulative Engagement
// Calls the social.get_cumulative_engagement() PostgreSQL function which
// returns a running total of all four engagement signals over time.
// p_client_id is passed explicitly because the function uses SECURITY DEFINER.
// ---------------------------------------------------------------------------

export async function getCumulativeEngagement(
  clientId: string,
  candidate?: string,
  startDate?: string,
  endDate?: string
): Promise<CumulativeEngagementRow[]> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('social')
    .rpc('get_cumulative_engagement', {
      p_client_id:  clientId,
      p_candidate:  candidate  ?? null,
      p_start_date: startDate  ?? null,
      p_end_date:   endDate    ?? null,
    })

  if (error) throw new Error(`cumulative-engagement query failed: ${error.message}`)

  return (data ?? []) as CumulativeEngagementRow[]
}

// ---------------------------------------------------------------------------
// Content Table
// Paginated, sortable, searchable feed of raw social_media_content rows.
// total_engagement is computed in JS by summing the four engagement columns.
// RLS enforces client_id isolation automatically via the server client.
// ---------------------------------------------------------------------------

const SORTABLE_COLUMNS = new Set<string>([
  'inserted_at',
  'candidate_name',
  'platform',
  'likes_count',
  'replies_count',
  'shares_count',
  'bookmarks_count',
  'views_count',
  'total_engagement',
])

export async function getContentTable(
  params: ContentTableParams = {}
): Promise<PaginatedResponse<ContentTableRow>> {
  const supabase = await createClient()

  const page       = Math.max(1, params.page  ?? 1)
  const limit      = Math.min(100, Math.max(1, params.limit ?? 20))
  const from       = (page - 1) * limit
  const to         = from + limit - 1

  // Resolve and validate sort column — default to inserted_at
  const rawColumn  = params.sort_column ?? 'inserted_at'
  const sortColumn = SORTABLE_COLUMNS.has(String(rawColumn))
    ? String(rawColumn)
    : 'inserted_at'
  const ascending  = (params.sort_order ?? 'desc') === 'asc'

  // When sorting by the virtual column, fall back to a real column Postgres can use
  const dbSortColumn = sortColumn === 'total_engagement'
    ? 'likes_count'   // rough proxy; precise sort handled client-side if needed
    : sortColumn

  let query = supabase
    .schema('social')
    .from('social_media_content')
    .select(
      'id, candidate_name, platform, inserted_at, content, likes_count, replies_count, shares_count, bookmarks_count, views_count, url',
      { count: 'exact' }
    )
    .order(dbSortColumn, { ascending })
    .range(from, to)

  if (params.search_query) {
    query = query.or(
      `candidate_name.ilike.%${params.search_query}%,content.ilike.%${params.search_query}%`
    )
  }
  if (params.platform)   query = query.eq('platform', params.platform)
  if (params.start_date) query = query.gte('inserted_at', params.start_date)
  if (params.end_date)   query = query.lte('inserted_at', params.end_date)

  const { data, error, count } = await query

  if (error) throw new Error(`content-table query failed: ${error.message}`)

  // Compute virtual total_engagement column
  const rows: ContentTableRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id:               row.id as string,
    candidate_name:   row.candidate_name as string,
    platform:         row.platform as string,
    post_date:        row.inserted_at as string,
    content:          row.content as string,
    likes_count:      (row.likes_count as number)     ?? 0,
    replies_count:    (row.replies_count as number)   ?? 0,
    shares_count:     (row.shares_count as number)    ?? 0,
    bookmarks_count:  (row.bookmarks_count as number) ?? 0,
    views_count:      (row.views_count as number)     ?? 0,
    url:              row.url as string | null,
    total_engagement:
      ((row.likes_count     as number) ?? 0) +
      ((row.replies_count   as number) ?? 0) +
      ((row.shares_count    as number) ?? 0) +
      ((row.bookmarks_count as number) ?? 0),
  }))

  return {
    data:        rows,
    total_count: count ?? 0,
    page,
    limit,
  }
}

// ---------------------------------------------------------------------------
// Follower Metrics Table
// Paginated, sortable, searchable feed of raw candidate_follower_metrics rows.
// No virtual columns — total_followers is a real column.
// RLS enforces client_id isolation automatically via the server client.
// ---------------------------------------------------------------------------

const FOLLOWER_SORTABLE_COLUMNS = new Set<string>([
  'inserted_at',
  'candidate_name',
  'total_followers',
])

export async function getFollowerMetricsTable(
  params: FollowerMetricsParams = {}
): Promise<PaginatedResponse<FollowerMetricsRow>> {
  const supabase = await createClient()

  const page      = Math.max(1, params.page  ?? 1)
  const limit     = Math.min(100, Math.max(1, params.limit ?? 20))
  const from      = (page - 1) * limit
  const to        = from + limit - 1

  const rawColumn  = params.sort_column ?? 'inserted_at'
  const sortColumn = FOLLOWER_SORTABLE_COLUMNS.has(String(rawColumn))
    ? String(rawColumn)
    : 'inserted_at'
  const ascending  = (params.sort_order ?? 'desc') === 'asc'

  let query = supabase
    .schema('social')
    .from('candidate_follower_metrics')
    .select('id, candidate_name, inserted_at, total_followers', { count: 'exact' })
    .order(sortColumn, { ascending })
    .range(from, to)

  if (params.search_query) {
    query = query.ilike('candidate_name', `%${params.search_query}%`)
  }
  if (params.start_date) query = query.gte('inserted_at', params.start_date)
  if (params.end_date)   query = query.lte('inserted_at', params.end_date)

  const { data, error, count } = await query

  if (error) throw new Error(`follower-metrics-table query failed: ${error.message}`)

  return {
    data:        (data ?? []) as FollowerMetricsRow[],
    total_count: count ?? 0,
    page,
    limit,
  }
}

// ---------------------------------------------------------------------------
// Posts Table
// Paginated, sortable, searchable feed of raw social_media_content rows.
// account_followers, account_url, and account_handle are excluded from SELECT.
// Both start_date and end_date are required.
// Date range is enforced upstream in the route handler — not here.
// total_engagement is computed in JS.
// RLS enforces client_id isolation automatically via the server client.
// ---------------------------------------------------------------------------

const POSTS_SORTABLE_COLUMNS = new Set<string>([
  'inserted_at',
  'candidate_name',
  'platform',
  'likes_count',
  'replies_count',
  'shares_count',
  'bookmarks_count',
  'views_count',
  'total_engagement',
])

export async function getPostsTable(
  params: PostsParams
): Promise<PaginatedResponse<PostsRow>> {
  const supabase = await createClient()

  const page      = Math.max(1, params.page  ?? 1)
  const limit     = Math.min(100, Math.max(1, params.limit ?? 20))
  const from      = (page - 1) * limit
  const to        = from + limit - 1

  const rawColumn  = params.sort_column ?? 'inserted_at'
  const sortColumn = POSTS_SORTABLE_COLUMNS.has(String(rawColumn))
    ? String(rawColumn)
    : 'inserted_at'
  const ascending  = (params.sort_order ?? 'desc') === 'asc'

  const dbSortColumn = sortColumn === 'total_engagement' ? 'likes_count' : sortColumn

  // account_followers, account_url, account_handle are intentionally omitted
  let query = supabase
    .schema('social')
    .from('social_media_content')
    .select(
      'id, candidate_name, platform, inserted_at, content, likes_count, replies_count, shares_count, bookmarks_count, views_count, url',
      { count: 'exact' }
    )
    .gte('inserted_at', params.start_date)
    .lte('inserted_at', params.end_date)
    .order(dbSortColumn, { ascending })
    .range(from, to)

  if (params.search_query) {
    query = query.or(
      `candidate_name.ilike.%${params.search_query}%,content.ilike.%${params.search_query}%`
    )
  }
  if (params.platform)  query = query.eq('platform', params.platform)
  if (params.candidate) query = query.ilike('candidate_name', `%${params.candidate}%`)

  const { data, error, count } = await query

  if (error) throw new Error(`posts-table query failed: ${error.message}`)

  const rows: PostsRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id:               row.id               as string,
    candidate_name:   row.candidate_name   as string,
    platform:         row.platform         as string,
    inserted_at:      row.inserted_at      as string,
    content:          row.content          as string,
    likes_count:      (row.likes_count     as number) ?? 0,
    replies_count:    (row.replies_count   as number) ?? 0,
    shares_count:     (row.shares_count    as number) ?? 0,
    bookmarks_count:  (row.bookmarks_count as number) ?? 0,
    views_count:      (row.views_count     as number) ?? 0,
    url:              row.url              as string | null,
    total_engagement:
      ((row.likes_count     as number) ?? 0) +
      ((row.replies_count   as number) ?? 0) +
      ((row.shares_count    as number) ?? 0) +
      ((row.bookmarks_count as number) ?? 0),
  }))

  return {
    data:        rows,
    total_count: count ?? 0,
    page,
    limit,
  }
}

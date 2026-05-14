// ---------------------------------------------------------------------------
// social.candidate_follower_metrics
// ---------------------------------------------------------------------------

export interface FollowerGrowthRow {
  inserted_at: string       // ISO date string
  candidate_name: string
  total_followers: number
  platform: string          // e.g. "x" | "facebook" | "instagram"
}

// ---------------------------------------------------------------------------
// social.social_media_content (weekly aggregation)
// ---------------------------------------------------------------------------

export interface WeeklyEngagementRow {
  week_start: string        // ISO date string for the Monday of that week
  candidate_name: string
  likes_count: number
  replies_count: number
  shares_count: number
  bookmarks_count: number
  total_engagement: number  // sum of all four signals
}

// ---------------------------------------------------------------------------
// social.get_cumulative_engagement() RPC return shape
// ---------------------------------------------------------------------------

export interface CumulativeEngagementRow {
  inserted_at: string       // ISO date string
  daily_engagement: number
  cumulative_total: number
}

// ---------------------------------------------------------------------------
// social.social_media_content (paginated raw table)
// ---------------------------------------------------------------------------

export type SortOrder = 'asc' | 'desc'

export interface ContentTableRow {
  id: string
  candidate_name: string
  platform: string
  post_date: string          // ISO date string (inserted_at cast to date)
  content: string
  likes_count: number
  replies_count: number
  shares_count: number
  bookmarks_count: number
  views_count: number
  total_engagement: number   // virtual: sum of all four engagement signals
  url: string | null
}

export interface ContentTableParams {
  page?: number              // 1-based, defaults to 1
  limit?: number             // rows per page, defaults to 20
  sort_column?: keyof ContentTableRow
  sort_order?: SortOrder
  search_query?: string      // matched against candidate_name and content
  platform?: string
  start_date?: string
  end_date?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total_count: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// social.candidate_follower_metrics (paginated raw table)
// ---------------------------------------------------------------------------

export interface FollowerMetricsRow {
  id:              string
  candidate_name:  string
  platform:        string   // "x" | "facebook" | "instagram"
  inserted_at:     string   // ISO date string
  total_followers: number
}

export interface FollowerMetricsParams {
  page?:         number       // 1-based, defaults to 1
  limit?:        number       // rows per page, defaults to 20
  sort_column?:  keyof FollowerMetricsRow
  sort_order?:   SortOrder
  search_query?: string       // matched against candidate_name only
  platform?:     string
  start_date?:   string
  end_date?:     string
}

// ---------------------------------------------------------------------------
// social.social_media_content (raw posts — 90-day capped endpoint)
// account_followers, account_url, and account_handle are intentionally excluded.
// Both start_date and end_date are required. Range cannot exceed 90 days.
// ---------------------------------------------------------------------------

export interface PostsRow {
  id:              string
  candidate_name:  string
  platform:        string        // "x" | "facebook" | "instagram"
  inserted_at:     string        // ISO date string
  content:         string
  likes_count:     number
  replies_count:   number
  shares_count:    number
  bookmarks_count: number
  views_count:     number
  total_engagement: number       // virtual: likes + replies + shares + bookmarks
  url:             string | null
}

export interface PostsParams {
  start_date:    string          // required — ISO date string
  end_date:      string          // required — ISO date string; diff from start_date must be <= 90 days
  page?:         number          // 1-based, defaults to 1
  limit?:        number          // rows per page, defaults to 20, max 100
  sort_column?:  keyof PostsRow
  sort_order?:   SortOrder
  search_query?: string          // matched against candidate_name and content
  platform?:     string
  candidate?:    string
}

export const MAX_DATE_RANGE_DAYS = 90

// ---------------------------------------------------------------------------
// Generic API response wrapper
// ---------------------------------------------------------------------------

export interface ApiSuccessResponse<T> {
  data: T[]
}

export interface ApiErrorResponse {
  error: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

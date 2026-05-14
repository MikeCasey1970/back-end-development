import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { BadRequestError } from '@/lib/api/errors'
import { getPostsTable } from '@/lib/analytics/queries'
import type { PostsParams, PostsRow, SortOrder } from '@/types/analytics'
import { MAX_DATE_RANGE_DAYS } from '@/types/analytics'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export const GET = withAuth(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = req.nextUrl

  // -------------------------------------------------------------------------
  // Date validation — both fields are required
  // -------------------------------------------------------------------------
  const startDate = searchParams.get('start_date')
  const endDate   = searchParams.get('end_date')

  if (!startDate) {
    throw new BadRequestError('start_date is required (YYYY-MM-DD).')
  }
  if (!endDate) {
    throw new BadRequestError('end_date is required (YYYY-MM-DD).')
  }

  const start = new Date(startDate)
  const end   = new Date(endDate)

  if (isNaN(start.getTime())) {
    throw new BadRequestError('start_date is not a valid date.')
  }
  if (isNaN(end.getTime())) {
    throw new BadRequestError('end_date is not a valid date.')
  }
  if (end < start) {
    throw new BadRequestError('end_date cannot be before start_date.')
  }

  // -------------------------------------------------------------------------
  // 90-day cap enforcement
  // -------------------------------------------------------------------------
  const diffDays = (end.getTime() - start.getTime()) / MS_PER_DAY

  if (diffDays > MAX_DATE_RANGE_DAYS) {
    throw new BadRequestError(
      `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days. Requested range is ${Math.ceil(diffDays)} days.`
    )
  }

  // -------------------------------------------------------------------------
  // Build params and query
  // -------------------------------------------------------------------------
  const params: PostsParams = {
    start_date:   startDate,
    end_date:     endDate,
    page:         searchParams.has('page')         ? Number(searchParams.get('page'))  : 1,
    limit:        searchParams.has('limit')        ? Number(searchParams.get('limit')) : 20,
    sort_column:  (searchParams.get('sort_column') ?? 'inserted_at') as keyof PostsRow,
    sort_order:   (searchParams.get('sort_order')  ?? 'desc') as SortOrder,
    search_query: searchParams.get('search_query') ?? undefined,
    platform:     searchParams.get('platform')     ?? undefined,
    candidate:    searchParams.get('candidate')    ?? undefined,
  }

  const result = await getPostsTable(params)

  return NextResponse.json(
    { data: result.data, page: result.page, limit: result.limit },
    {
      status: 200,
      headers: {
        'X-Total-Count':                String(result.total_count),
        'Access-Control-Expose-Headers': 'X-Total-Count',
      },
    }
  )
})

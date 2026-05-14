import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { getFollowerMetricsTable } from '@/lib/analytics/queries'
import type { FollowerMetricsParams, FollowerMetricsRow, SortOrder } from '@/types/analytics'

export const GET = withAuth(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = req.nextUrl

  const params: FollowerMetricsParams = {
    page:         searchParams.has('page')         ? Number(searchParams.get('page'))  : 1,
    limit:        searchParams.has('limit')        ? Number(searchParams.get('limit')) : 20,
    sort_column:  (searchParams.get('sort_column') ?? 'inserted_at') as keyof FollowerMetricsRow,
    sort_order:   (searchParams.get('sort_order')  ?? 'desc') as SortOrder,
    search_query: searchParams.get('search_query') ?? undefined,
    platform:     searchParams.get('platform')     ?? undefined,
    start_date:   searchParams.get('start_date')   ?? undefined,
    end_date:     searchParams.get('end_date')     ?? undefined,
  }

  const result = await getFollowerMetricsTable(params)

  return NextResponse.json(
    { data: result.data, page: result.page, limit: result.limit },
    {
      status: 200,
      headers: {
        'X-Total-Count': String(result.total_count),
        'Access-Control-Expose-Headers': 'X-Total-Count',
      },
    }
  )
})

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { getContentTable } from '@/lib/analytics/queries'
import type { ContentTableParams, ContentTableRow, SortOrder } from '@/types/analytics'

export const GET = withAuth(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = req.nextUrl

  const params: ContentTableParams = {
    page:         searchParams.has('page')         ? Number(searchParams.get('page'))  : 1,
    limit:        searchParams.has('limit')        ? Number(searchParams.get('limit')) : 20,
    sort_column:  (searchParams.get('sort_column') ?? 'inserted_at') as keyof ContentTableRow,
    sort_order:   (searchParams.get('sort_order')  ?? 'desc') as SortOrder,
    search_query: searchParams.get('search_query') ?? undefined,
    platform:     searchParams.get('platform')     ?? undefined,
    start_date:   searchParams.get('start_date')   ?? undefined,
    end_date:     searchParams.get('end_date')     ?? undefined,
  }

  const result = await getContentTable(params)

  return NextResponse.json(
    { data: result.data, page: result.page, limit: result.limit },
    {
      status: 200,
      headers: {
        // Expose total_count as a header so the frontend can drive
        // pagination controls without parsing the body first.
        'X-Total-Count': String(result.total_count),
        'Access-Control-Expose-Headers': 'X-Total-Count',
      },
    }
  )
})

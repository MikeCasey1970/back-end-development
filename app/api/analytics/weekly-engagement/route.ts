import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { getWeeklyEngagement } from '@/lib/analytics/queries'

export const GET = withAuth(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = req.nextUrl
  const startDate = searchParams.get('start_date') ?? undefined
  const endDate   = searchParams.get('end_date')   ?? undefined

  const data = await getWeeklyEngagement(startDate, endDate)

  return NextResponse.json({ data })
})

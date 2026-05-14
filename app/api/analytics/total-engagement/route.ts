import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { getClientId } from '@/lib/supabase/server'
import { getCumulativeEngagement } from '@/lib/analytics/queries'

export const GET = withAuth(async (req: NextRequest): Promise<NextResponse> => {
  // Resolve the authenticated user's ID — this is the p_client_id passed to
  // the SECURITY DEFINER function which bypasses RLS internally.
  const clientId = await getClientId()

  const { searchParams } = req.nextUrl
  const candidate = searchParams.get('candidate')  ?? undefined
  const startDate = searchParams.get('start_date') ?? undefined
  const endDate   = searchParams.get('end_date')   ?? undefined

  const data = await getCumulativeEngagement(clientId, candidate, startDate, endDate)

  return NextResponse.json({ data })
})

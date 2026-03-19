import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSnapshotMonths, getMovements } from '@/lib/db'
import { getMockMovements, MOCK_SNAPSHOT_MONTHS } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const month = searchParams.get('month')

  // Return available months list
  if (!month) {
    let months = getAvailableSnapshotMonths()
    if (months.length === 0) months = MOCK_SNAPSHOT_MONTHS
    return NextResponse.json({ months })
  }

  const result = getMovements(month)
  const hasData = result.switches.length > 0 || Object.keys(result.gained).length > 0
  const final = hasData ? result : getMockMovements(month)
  return NextResponse.json({ month, ...final })
}

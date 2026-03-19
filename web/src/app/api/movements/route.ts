import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSnapshotMonths, getMovements } from '@/lib/db'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const month = searchParams.get('month')

  // Return available months list
  if (!month) {
    const months = getAvailableSnapshotMonths()
    return NextResponse.json({ months })
  }

  const result = getMovements(month)
  return NextResponse.json({ month, ...result })
}

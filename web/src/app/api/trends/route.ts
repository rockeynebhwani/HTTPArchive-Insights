import { NextResponse } from 'next/server'
import { getTrends } from '@/lib/db'
import { PLATFORM_ORDER } from '@/lib/colors'
import { getMockTrends } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export function GET() {
  let rows = getTrends()
  if (rows.length === 0) rows = getMockTrends()

  if (rows.length === 0) {
    return NextResponse.json({ months: [], platforms: [], data: {} })
  }

  const months = [...new Set(rows.map(r => r.snapshot_month))].sort()
  const platforms = PLATFORM_ORDER.filter(p => rows.some(r => r.platform === p))

  const data: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    if (!data[row.platform]) data[row.platform] = {}
    data[row.platform][row.snapshot_month] = row.site_count
  }

  return NextResponse.json({ months, platforms, data })
}

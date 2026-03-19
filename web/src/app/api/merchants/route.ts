import { NextRequest, NextResponse } from 'next/server'
import { getMerchants, getMerchantsNewOrLost } from '@/lib/db'
import { getMockMerchants, getMockMerchantsNewOrLost } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const month = searchParams.get('month')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type') as 'new' | 'lost' | null

  if (!month || !to) {
    return NextResponse.json({ error: 'month and to are required' }, { status: 400 })
  }

  if (type === 'new' || type === 'lost') {
    let merchants = getMerchantsNewOrLost(month, to, type)
    if (merchants.length === 0) merchants = getMockMerchantsNewOrLost(to, type)
    return NextResponse.json({ merchants, total: merchants.length })
  }

  if (!from) {
    return NextResponse.json({ error: 'from is required for switch drill-down' }, { status: 400 })
  }

  let merchants = getMerchants(month, from, to)
  if (merchants.length === 0) merchants = getMockMerchants(from, to)
  return NextResponse.json({ merchants, total: merchants.length })
}

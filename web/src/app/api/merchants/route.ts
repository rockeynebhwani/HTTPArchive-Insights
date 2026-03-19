import { NextRequest, NextResponse } from 'next/server'
import { getMerchants, getMerchantsNewOrLost } from '@/lib/db'

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
    const merchants = getMerchantsNewOrLost(month, to, type)
    return NextResponse.json({ merchants, total: merchants.length })
  }

  if (!from) {
    return NextResponse.json({ error: 'from is required for switch drill-down' }, { status: 400 })
  }

  const merchants = getMerchants(month, from, to)
  return NextResponse.json({ merchants, total: merchants.length })
}

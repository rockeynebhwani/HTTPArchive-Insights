'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { PLATFORM_COLORS, PLATFORM_ORDER } from '@/lib/colors'

interface TrendsData {
  months: string[]
  platforms: string[]
  data: Record<string, Record<string, number>>
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function TrendsChart() {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trends')
      .then(r => r.json())
      .then(d => { setTrendsData(d); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-muted">
        Loading trends…
      </div>
    )
  }

  if (!trendsData || trendsData.months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-muted">
        <p className="text-lg">No data yet</p>
        <p className="text-sm">Run the pipeline to populate data.</p>
      </div>
    )
  }

  // Flatten to recharts format: [{month, Shopify: 1234, WooCommerce: 567, ...}]
  const chartData = trendsData.months.map(m => {
    const row: Record<string, string | number> = { month: m }
    for (const p of trendsData.platforms) {
      row[p] = trendsData.data[p]?.[m] ?? 0
    }
    return row
  })

  const visiblePlatforms = trendsData.platforms.filter(p => !hidden.has(p))

  const togglePlatform = (p: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Platform toggles */}
      <div className="flex flex-wrap gap-2">
        {trendsData.platforms.map(p => {
          const isHidden = hidden.has(p)
          return (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor: isHidden ? '#1c1c30' : PLATFORM_COLORS[p] ?? '#888',
                color: isHidden ? '#6b6b8a' : PLATFORM_COLORS[p] ?? '#888',
                background: isHidden ? 'transparent' : `${PLATFORM_COLORS[p]}18`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: isHidden ? '#6b6b8a' : PLATFORM_COLORS[p] ?? '#888' }}
              />
              {p}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c30" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6b6b8a', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1c1c30' }}
            tickFormatter={v => v.slice(0, 7)}
            interval={11}
          />
          <YAxis
            tick={{ fill: '#6b6b8a', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCount}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: '#10101e', border: '1px solid #1c1c30', borderRadius: 8 }}
            labelStyle={{ color: '#e2e2e8', fontSize: 12, marginBottom: 6 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) => [
              formatCount(value),
              name,
            ]}
          />
          {visiblePlatforms.map(p => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              stroke={PLATFORM_COLORS[p] ?? '#888'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

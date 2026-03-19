'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PLATFORM_COLORS } from '@/lib/colors'

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
  const [trendsData, setTrendsData]   = useState<TrendsData | null>(null)
  const [hidden, setHidden]           = useState<Set<string>>(new Set())
  const [soloed, setSoloed]           = useState<string | null>(null)
  const [logScale, setLogScale]       = useState(false)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    fetch('/api/trends')
      .then(r => r.json())
      .then((d: TrendsData) => { setTrendsData(d); setLoading(false) })
  }, [])

  const togglePlatform = useCallback((p: string) => {
    setSoloed(null) // clear solo when manually toggling
    setHidden(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }, [])

  // Solo: click to isolate one platform, click same again to restore all
  const handleSolo = useCallback((p: string) => {
    if (soloed === p) {
      setSoloed(null)
      setHidden(new Set())
    } else {
      setSoloed(p)
      setHidden(new Set())
    }
  }, [soloed])

  const showAll = useCallback(() => { setHidden(new Set()); setSoloed(null) }, [])
  const hideAll = useCallback(() => {
    if (!trendsData) return
    setHidden(new Set(trendsData.platforms))
    setSoloed(null)
  }, [trendsData])

  if (loading) return (
    <div className="flex items-center justify-center h-96 text-muted">Loading trends…</div>
  )
  if (!trendsData || trendsData.months.length === 0) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3 text-muted">
      <p className="text-lg">No data yet</p>
      <p className="text-sm">Run the pipeline to populate data.</p>
    </div>
  )

  const chartData = trendsData.months.map(m => {
    const row: Record<string, string | number> = { month: m }
    for (const p of trendsData.platforms) row[p] = trendsData.data[p]?.[m] ?? 0
    return row
  })

  // Which platforms are visible
  const visiblePlatforms = trendsData.platforms.filter(p =>
    soloed ? p === soloed : !hidden.has(p)
  )

  const anyHidden = hidden.size > 0 || soloed !== null

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Hint */}
        <p className="text-xs text-muted">
          <span className="font-medium text-white/60">Click</span> to hide/show ·{' '}
          <span className="font-medium text-white/60">Double-click</span> to isolate
        </p>

        <div className="flex items-center gap-2">
          {/* Log scale toggle */}
          <button
            onClick={() => setLogScale(l => !l)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              logScale
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-surface border-border text-muted hover:text-white'
            }`}
            title="Log scale makes small platforms visible alongside large ones"
          >
            <span>Log scale</span>
            {logScale && <span className="opacity-70">✓</span>}
          </button>

          {/* Show all / Hide all */}
          {anyHidden && (
            <button
              onClick={showAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:text-white bg-surface transition-all"
            >
              Show all
            </button>
          )}
          {!anyHidden && (
            <button
              onClick={hideAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:text-white bg-surface transition-all"
            >
              Hide all
            </button>
          )}
        </div>
      </div>

      {/* Platform toggles */}
      <div className="flex flex-wrap gap-2">
        {trendsData.platforms.map(p => {
          const isVisible = soloed ? p === soloed : !hidden.has(p)
          const isSoloed  = soloed === p
          const color     = PLATFORM_COLORS[p] ?? '#888'

          return (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              onDoubleClick={e => { e.preventDefault(); handleSolo(p) }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor:  isVisible ? color : '#2a2a40',
                color:        isVisible ? color : '#4a4a6a',
                background:   isSoloed ? `${color}30` : isVisible ? `${color}15` : 'transparent',
                textDecoration: isVisible ? 'none' : 'line-through',
                textDecorationColor: '#4a4a6a',
                opacity: isVisible ? 1 : 0.5,
              }}
              title={isSoloed ? 'Double-click to restore all' : 'Click to hide · Double-click to isolate'}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
                style={{ background: isVisible ? color : '#4a4a6a' }}
              />
              {p}
              {isSoloed && <span className="ml-1 text-[9px] opacity-70 font-bold uppercase tracking-wider">solo</span>}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={440}>
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
            scale={logScale ? 'log' : 'auto'}
            domain={logScale ? [1, 'auto'] : undefined}
            allowDataOverflow={logScale}
            tick={{ fill: '#6b6b8a', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCount}
            width={52}
          />
          <Tooltip
            contentStyle={{ background: '#10101e', border: '1px solid #1c1c30', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}
            labelStyle={{ color: '#e2e2e8', fontSize: 12, marginBottom: 6 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) => [formatCount(value), name]}
            itemSorter={item => -(item.value as number)}
          />
          {visiblePlatforms.map(p => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              stroke={PLATFORM_COLORS[p] ?? '#888'}
              strokeWidth={soloed === p ? 2.5 : 1.8}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {logScale && (
        <p className="text-xs text-muted text-center">
          Log scale active — each grid line represents a 10× increase, making small platforms visible alongside large ones
        </p>
      )}
    </div>
  )
}

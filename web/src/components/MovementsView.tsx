'use client'

import { useState, useEffect, useCallback } from 'react'
import SankeyDiagram, { SankeyMovement } from './SankeyDiagram'
import ChordDiagram from './ChordDiagram'
import MerchantDrawer from './MerchantDrawer'
import { PLATFORM_COLORS } from '@/lib/colors'

type DiagramView = 'sankey' | 'chord'

interface MovementsData {
  month: string
  prevMonth: string | null
  switches: { from_platform: string; to_platform: string; count: number }[]
  gained: Record<string, number>
  lost: Record<string, number>
}

interface DrawerSelection {
  month: string
  from: string
  to: string
  count: number
  type?: 'switch' | 'new' | 'lost'
}

export default function MovementsView() {
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [data, setData] = useState<MovementsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [drawer, setDrawer] = useState<DrawerSelection | null>(null)
  const [view, setView] = useState<DiagramView>('sankey')

  useEffect(() => {
    fetch('/api/movements')
      .then(r => r.json())
      .then(d => {
        setMonths(d.months ?? [])
        if (d.months?.length > 0) setSelectedMonth(d.months[d.months.length - 1])
      })
  }, [])

  useEffect(() => {
    if (!selectedMonth) return
    setLoading(true)
    fetch(`/api/movements?month=${selectedMonth}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [selectedMonth])

  const handleLinkClick = useCallback((from: string, to: string, count: number) => {
    setDrawer({ month: selectedMonth, from, to, count, type: 'switch' })
  }, [selectedMonth])

  const totalSwitches = data?.switches.reduce((s, r) => s + r.count, 0) ?? 0

  const sankeyMovements: SankeyMovement[] = (data?.switches ?? [])
    .filter(s => s.count > 0)
    .map(s => ({ from: s.from_platform, to: s.to_platform, count: s.count }))

  // Top gainers and losers by net change
  const netChange: Record<string, number> = {}
  for (const [p, n] of Object.entries(data?.gained ?? {})) netChange[p] = (netChange[p] ?? 0) + n
  for (const [p, n] of Object.entries(data?.lost ?? {})) netChange[p] = (netChange[p] ?? 0) - n

  const sorted = Object.entries(netChange).sort((a, b) => b[1] - a[1])

  if (months.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
        <p className="text-lg">No movement data yet</p>
        <p className="text-sm">Run the pipeline with <code className="font-mono bg-surface px-1.5 py-0.5 rounded">--backfill</code> to populate snapshots.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Month</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {[...months].reverse().map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {data?.prevMonth && (
          <span className="text-xs text-muted">
            Comparing {data.prevMonth} → {data.month}
          </span>
        )}
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Platform Switches</p>
            <p className="text-2xl font-bold text-white">{totalSwitches.toLocaleString()}</p>
          </div>
          {sorted.slice(0, 3).map(([platform, net]) => (
            <div key={platform} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1 truncate">{platform}</p>
              <p
                className="text-2xl font-bold"
                style={{ color: net > 0 ? '#22C55E' : '#EF4444' }}
              >
                {net > 0 ? '+' : ''}{net.toLocaleString()}
              </p>
              <p className="text-xs text-muted mt-0.5">net change</p>
            </div>
          ))}
        </div>
      )}

      {/* Platform gain/loss bar */}
      {data && sorted.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted mb-4">Net merchant change (new − lost)</p>
          <div className="space-y-2.5">
            {sorted.map(([platform, net]) => {
              const max = Math.max(...sorted.map(([, n]) => Math.abs(n)), 1)
              const pct = (Math.abs(net) / max) * 100
              return (
                <div key={platform} className="flex items-center gap-3">
                  <span
                    className="text-xs w-40 truncate text-right"
                    style={{ color: PLATFORM_COLORS[platform] ?? '#888' }}
                  >
                    {platform}
                  </span>
                  <div className="flex-1 flex items-center gap-1">
                    {net < 0 && (
                      <div className="flex justify-end" style={{ width: '50%' }}>
                        <div
                          className="h-4 rounded-sm transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: '#EF4444',
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    )}
                    {net >= 0 && <div style={{ width: '50%' }} />}
                    <div className="w-px h-4 bg-border" />
                    {net > 0 && (
                      <div style={{ width: '50%' }}>
                        <div
                          className="h-4 rounded-sm transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: '#22C55E',
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    )}
                    {net <= 0 && <div style={{ width: '50%' }} />}
                  </div>
                  <span
                    className="text-xs w-16 font-mono"
                    style={{ color: net > 0 ? '#22C55E' : net < 0 ? '#EF4444' : '#6b6b8a' }}
                  >
                    {net > 0 ? '+' : ''}{net.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Flow diagram */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Platform Switches</h3>
            <p className="text-xs text-muted mt-0.5">Click any flow to see which merchants moved</p>
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1">
            <button
              onClick={() => setView('sankey')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'sankey'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              ↔ Sankey
            </button>
            <button
              onClick={() => setView('chord')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'chord'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              ◎ Chord
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted text-sm">Loading…</div>
        ) : view === 'sankey' ? (
          <SankeyDiagram movements={sankeyMovements} onLinkClick={handleLinkClick} />
        ) : (
          <ChordDiagram movements={sankeyMovements} onFlowClick={handleLinkClick} />
        )}
      </div>

      <MerchantDrawer selection={drawer} onClose={() => setDrawer(null)} />
    </div>
  )
}

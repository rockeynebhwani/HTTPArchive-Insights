'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { pack, hierarchy } from 'd3-hierarchy'
import { PLATFORM_COLORS, PLATFORM_ORDER } from '@/lib/colors'

interface TrendsData {
  months: string[]
  platforms: string[]
  data: Record<string, Record<string, number>>
}

interface Bubble {
  platform: string
  cx: number
  cy: number
  r: number
  count: number
}

const SPEEDS = [
  { label: '0.5×', ms: 900 },
  { label: '1×',   ms: 500 },
  { label: '2×',   ms: 250 },
  { label: '4×',   ms: 120 },
]

function formatMonth(ym: string) {
  return new Date(ym + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function shortName(p: string) {
  return p
    .replace('Salesforce ', 'SF ')
    .replace(' Commerce Cloud', '')
    .replace(' Commerce', '')
    .replace(' eCommerce', '')
}

export default function BubbleRace() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [trends, setTrends]     = useState<TrendsData | null>(null)
  const [monthIdx, setMonthIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speedIdx, setSpeedIdx]   = useState(1)
  const [bubbles, setBubbles]     = useState<Bubble[]>([])
  const [dims, setDims]           = useState({ w: 800, h: 580 })
  const [hovered, setHovered]     = useState<string | null>(null)

  // Fetch trends
  useEffect(() => {
    fetch('/api/trends')
      .then(r => r.json())
      .then((d: TrendsData) => {
        setTrends(d)
        if (d.months?.length) setMonthIdx(0)
      })
  }, [])

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      setDims({ w, h: Math.max(500, Math.min(Math.round(w * 0.72), 680)) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Compute pack layout whenever month or dims change
  useEffect(() => {
    if (!trends?.months.length) return
    const month = trends.months[monthIdx]

    const children = PLATFORM_ORDER
      .filter(p => trends.data[p])
      .map(p => ({
        name: p,
        value: Math.max(1, trends.data[p]?.[month] ?? 0),
        count: trends.data[p]?.[month] ?? 0,
      }))

    type Leaf = { name: string; value: number; count: number }
    const root = hierarchy<{ children?: Leaf[]; name?: string; value?: number; count?: number }>({ children })
      .sum(d => d.value ?? 0)

    pack<typeof root.data>()
      .size([dims.w - 10, dims.h - 10])
      .padding(7)(root)

    setBubbles(
      root.leaves().map(leaf => ({
        platform: leaf.data.name!,
        cx: (leaf.x ?? 0) + 5,
        cy: (leaf.y ?? 0) + 5,
        r: Math.max(4, leaf.r ?? 4),
        count: leaf.data.count!,
      }))
    )
  }, [trends, monthIdx, dims])

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying || !trends) return
    const ms = SPEEDS[speedIdx].ms
    const timer = setInterval(() => {
      setMonthIdx(i => {
        if (i >= trends.months.length - 1) { setIsPlaying(false); return i }
        return i + 1
      })
    }, ms)
    return () => clearInterval(timer)
  }, [isPlaying, trends, speedIdx])

  const reset = useCallback(() => { setIsPlaying(false); setMonthIdx(0) }, [])

  const currentMonth = trends?.months[monthIdx] ?? ''
  const year = currentMonth.substring(0, 4)

  return (
    <div ref={containerRef} className="w-full space-y-4">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            // If already at the end, rewind to start before playing
            if (!isPlaying && monthIdx >= (trends?.months.length ?? 1) - 1) {
              setMonthIdx(0)
            }
            setIsPlaying(p => !p)
          }}
          disabled={!trends}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <button
          onClick={reset}
          className="px-3 py-2 bg-surface border border-border text-muted hover:text-white rounded-lg text-sm transition-colors"
        >
          ↺
        </button>

        {/* Speed picker */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                speedIdx === i ? 'bg-indigo-600 text-white' : 'text-muted hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={(trends?.months.length ?? 1) - 1}
          value={monthIdx}
          onChange={e => { setIsPlaying(false); setMonthIdx(Number(e.target.value)) }}
          className="flex-1 min-w-[100px] accent-indigo-500"
        />

        <span className="text-sm font-mono text-white w-24 text-right">
          {currentMonth ? formatMonth(currentMonth) : '—'}
        </span>
      </div>

      {/* Canvas */}
      <div className="relative bg-surface border border-border rounded-2xl overflow-hidden select-none">

        {/* Ghost year watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span
            className="font-bold text-white leading-none transition-all duration-500"
            style={{ fontSize: Math.min(dims.w * 0.38, 240), opacity: 0.035 }}
          >
            {year}
          </span>
        </div>

        <svg
          width={dims.w}
          height={dims.h}
          className="w-full block"
        >
          {bubbles.map(b => {
            const color     = PLATFORM_COLORS[b.platform] ?? '#6b6b8a'
            const isHovered = hovered === b.platform
            const isDimmed  = hovered !== null && !isHovered
            const showName  = b.r > 24
            const showCount = b.r > 38

            return (
              <g
                key={b.platform}
                transform={`translate(${b.cx},${b.cy})`}
                style={{ transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)', cursor: 'default' }}
                onMouseEnter={() => setHovered(b.platform)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Glow ring on hover */}
                {isHovered && (
                  <circle
                    r={b.r + 5}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={0.4}
                    style={{ transition: 'r 0.55s cubic-bezier(0.4,0,0.2,1)' }}
                  />
                )}

                <circle
                  r={b.r}
                  fill={color}
                  fillOpacity={isDimmed ? 0.06 : isHovered ? 0.35 : 0.18}
                  stroke={color}
                  strokeWidth={isDimmed ? 0.5 : 1.5}
                  strokeOpacity={isDimmed ? 0.2 : 0.75}
                  style={{ transition: 'r 0.55s cubic-bezier(0.4,0,0.2,1), fill-opacity 0.2s, stroke-opacity 0.2s' }}
                />

                {/* Platform name */}
                {showName && (
                  <text
                    textAnchor="middle"
                    dy={showCount ? '-0.55em' : '0.35em'}
                    fill={color}
                    fillOpacity={isDimmed ? 0.25 : 1}
                    fontSize={Math.max(9, Math.min(14, b.r / 3.2))}
                    fontWeight={600}
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ pointerEvents: 'none', transition: 'fill-opacity 0.2s' }}
                  >
                    {shortName(b.platform)}
                  </text>
                )}

                {/* Site count */}
                {showCount && (
                  <text
                    textAnchor="middle"
                    dy="0.9em"
                    fill={color}
                    fillOpacity={isDimmed ? 0.15 : 0.75}
                    fontSize={Math.max(8, Math.min(12, b.r / 4.5))}
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ pointerEvents: 'none', transition: 'fill-opacity 0.2s' }}
                  >
                    {b.count >= 1000
                      ? `${(b.count / 1000).toFixed(b.count >= 100_000 ? 0 : 1)}k`
                      : b.count}
                  </text>
                )}

                {/* Tooltip for small bubbles on hover */}
                {isHovered && !showName && (
                  <text
                    textAnchor="middle"
                    dy="-1.2em"
                    fill={color}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {shortName(b.platform)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        {hovered && (() => {
          const b = bubbles.find(x => x.platform === hovered)
          if (!b) return null
          const color = PLATFORM_COLORS[hovered] ?? '#6b6b8a'
          return (
            <div className="absolute bottom-4 left-4 bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl px-4 py-3 pointer-events-none">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-sm font-semibold text-white">{hovered}</span>
              </div>
              <div className="text-xs text-muted">
                <span className="font-mono text-white font-bold text-base">
                  {b.count.toLocaleString()}
                </span>{' '}sites · {formatMonth(currentMonth)}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Mini legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {PLATFORM_ORDER.filter(p => trends?.data[p]).map(p => (
          <div
            key={p}
            className="flex items-center gap-1.5 cursor-default"
            onMouseEnter={() => setHovered(p)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: PLATFORM_COLORS[p] ?? '#6b6b8a', opacity: hovered && hovered !== p ? 0.3 : 1 }}
            />
            <span
              className="text-xs transition-colors"
              style={{ color: hovered === p ? (PLATFORM_COLORS[p] ?? '#fff') : hovered ? '#4a4a6a' : '#9090aa' }}
            >
              {p}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

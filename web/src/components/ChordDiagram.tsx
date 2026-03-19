'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { chord as d3chord, ribbon as d3ribbon, ChordGroup } from 'd3-chord'
import { arc as d3arc } from 'd3-shape'
import { PLATFORM_COLORS } from '@/lib/colors'

export interface ChordMovement { from: string; to: string; count: number }

interface Props {
  movements: ChordMovement[]
  onFlowClick: (from: string, to: string, count: number) => void
}

interface Tooltip {
  x: number; y: number
  from: string; to: string
  count: number; reverseCount: number
  total: number
}

function platformColor(name: string) { return PLATFORM_COLORS[name] ?? '#6b6b8a' }

export default function ChordDiagram({ movements, onFlowClick }: Props) {
  const svgRef       = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const totalFlow = movements.reduce((s, m) => s + m.count, 0)

  const hideTooltip = useCallback(() => setTooltip(null), [])

  useEffect(() => {
    const svg       = svgRef.current
    const container = containerRef.current
    if (!svg || !container || movements.length === 0) return

    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const W      = container.clientWidth
    const H      = Math.max(640, Math.min(W * 0.85, 780))
    const cx     = W / 2
    const cy     = H / 2
    const outerR = Math.min(cx, cy) - 110
    const innerR = outerR - 26

    svg.setAttribute('width',  String(W))
    svg.setAttribute('height', String(H))

    // ── matrix ───────────────────────────────────────────────────────────────
    const platforms = [...new Set([...movements.map(m => m.from), ...movements.map(m => m.to)])]
    const n   = platforms.length
    const idx = new Map(platforms.map((p, i) => [p, i]))

    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
    for (const m of movements) matrix[idx.get(m.from)!][idx.get(m.to)!] += m.count

    // Lookup: reverse flow count
    const reverseMap = new Map<string, number>()
    for (const m of movements) {
      const rev = movements.find(r => r.from === m.to && r.to === m.from)
      reverseMap.set(`${m.from}→${m.to}`, rev?.count ?? 0)
    }

    // ── d3-chord layout ───────────────────────────────────────────────────────
    const layout = d3chord().padAngle(0.04).sortSubgroups((a, b) => b.value - a.value)
    const chords = layout(matrix)

    const arcGen    = d3arc<ChordGroup>().innerRadius(innerR).outerRadius(outerR)
    const ribbonGen = d3ribbon().radius(innerR - 1)

    const ns = 'http://www.w3.org/2000/svg'
    const g  = document.createElementNS(ns, 'g')
    g.setAttribute('transform', `translate(${cx},${cy})`)

    // Track all ribbon paths for dimming
    const ribbonPaths: SVGPathElement[] = []

    // ── ribbons ───────────────────────────────────────────────────────────────
    const ribbonGroup = document.createElementNS(ns, 'g')
    for (const chord of chords) {
      const src = platforms[chord.source.index]
      const tgt = platforms[chord.target.index]
      const color = platformColor(src)

      const path = document.createElementNS(ns, 'path')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path.setAttribute('d', ribbonGen(chord as any) ?? '')
      path.setAttribute('fill', color)
      path.setAttribute('fill-opacity', '0.22')
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '0.8')
      path.setAttribute('stroke-opacity', '0.4')
      path.style.cursor = 'pointer'
      path.style.transition = 'fill-opacity 0.15s, stroke-opacity 0.15s'
      ribbonPaths.push(path)

      path.addEventListener('mouseenter', (e: MouseEvent) => {
        // Highlight hovered, dim rest
        ribbonPaths.forEach(p => {
          p.setAttribute('fill-opacity', p === path ? '0.72' : '0.05')
          p.setAttribute('stroke-opacity', p === path ? '0.9' : '0.08')
        })
        const rect = container.getBoundingClientRect()
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          from: src, to: tgt,
          count: chord.source.value,
          reverseCount: reverseMap.get(`${src}→${tgt}`) ?? 0,
          total: totalFlow,
        })
      })
      path.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = container.getBoundingClientRect()
        setTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null)
      })
      path.addEventListener('mouseleave', () => {
        ribbonPaths.forEach(p => {
          p.setAttribute('fill-opacity', '0.22')
          p.setAttribute('stroke-opacity', '0.4')
        })
        hideTooltip()
      })
      path.addEventListener('click', () => onFlowClick(src, tgt, chord.source.value))
      ribbonGroup.appendChild(path)
    }
    g.appendChild(ribbonGroup)

    // ── arcs ──────────────────────────────────────────────────────────────────
    const arcGroup = document.createElementNS(ns, 'g')
    for (const group of chords.groups) {
      const platform = platforms[group.index]
      const color    = platformColor(platform)

      const path = document.createElementNS(ns, 'path')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path.setAttribute('d', arcGen(group as any) ?? '')
      path.setAttribute('fill', color)
      path.setAttribute('stroke', '#0a0a16')
      path.setAttribute('stroke-width', '1.5')
      path.style.transition = 'opacity 0.15s'
      arcGroup.appendChild(path)

      // Only label arcs wide enough to avoid overlap (min ~7° span)
      const arcSpan = group.endAngle - group.startAngle
      if (arcSpan < 0.12) continue

      const midAngle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2
      const labelR   = outerR + 18
      const lx = labelR * Math.cos(midAngle)
      const ly = labelR * Math.sin(midAngle)
      const rightSide = Math.cos(midAngle) >= 0

      const shortLabel = platform
        .replace('Salesforce ', 'SF ')
        .replace(' Commerce Cloud', '')
        .replace(' Commerce', '')
        .replace(' eCommerce', '')

      const text = document.createElementNS(ns, 'text')
      text.setAttribute('x', String(lx))
      text.setAttribute('y', String(ly))
      text.setAttribute('dy', '0.35em')
      text.setAttribute('text-anchor', rightSide ? 'start' : 'end')
      text.setAttribute('fill', color)
      text.setAttribute('font-size', arcSpan > 0.3 ? '12' : '10')
      text.setAttribute('font-weight', '500')
      text.setAttribute('font-family', 'Inter, system-ui, sans-serif')
      text.textContent = arcSpan > 0.25 ? shortLabel : shortLabel.substring(0, 8)
      arcGroup.appendChild(text)
    }
    g.appendChild(arcGroup)
    svg.appendChild(g)
  }, [movements, onFlowClick, totalFlow, hideTooltip])

  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        No platform switches detected for this month.
      </div>
    )
  }

  const net = tooltip ? tooltip.count - tooltip.reverseCount : 0
  const pct = tooltip ? ((tooltip.count / tooltip.total) * 100).toFixed(1) : '0'

  return (
    <div ref={containerRef} className="w-full relative">
      <svg ref={svgRef} className="w-full overflow-visible" />

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 min-w-[200px]"
          style={{
            left: tooltip.x + 14,
            top:  tooltip.y - 10,
            transform: tooltip.x > (containerRef.current?.clientWidth ?? 0) - 240
              ? 'translateX(-110%)' : undefined,
          }}
        >
          <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl shadow-2xl p-4 text-sm">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: platformColor(tooltip.from) }}
              />
              <span className="font-semibold text-white truncate">{tooltip.from}</span>
              <span className="text-muted">→</span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: platformColor(tooltip.to) }}
              />
              <span className="font-semibold text-white truncate">{tooltip.to}</span>
            </div>

            {/* Stats */}
            <div className="space-y-1.5">
              <div className="flex justify-between gap-6">
                <span className="text-muted">Merchants moved</span>
                <span className="font-mono font-bold text-white">{tooltip.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-muted">% of all switches</span>
                <span className="font-mono text-indigo-300">{pct}%</span>
              </div>
              {tooltip.reverseCount > 0 && (
                <>
                  <div className="flex justify-between gap-6">
                    <span className="text-muted">Reverse flow</span>
                    <span className="font-mono text-white">{tooltip.reverseCount.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-[#2a2a4a] pt-1.5 flex justify-between gap-6">
                    <span className="text-muted">Net movement</span>
                    <span
                      className="font-mono font-bold"
                      style={{ color: net > 0 ? '#22C55E' : '#EF4444' }}
                    >
                      {net > 0 ? '+' : ''}{net.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-muted mt-3 border-t border-[#2a2a4a] pt-2">
              Click to drill into merchants
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { chord as d3chord, ribbon as d3ribbon, ChordGroup } from 'd3-chord'
import { arc as d3arc } from 'd3-shape'
import { PLATFORM_COLORS } from '@/lib/colors'

export interface ChordMovement {
  from: string
  to: string
  count: number
}

interface Props {
  movements: ChordMovement[]
  onFlowClick: (from: string, to: string, count: number) => void
}

function platformColor(name: string) {
  return PLATFORM_COLORS[name] ?? '#6b6b8a'
}

export default function ChordDiagram({ movements, onFlowClick }: Props) {
  const svgRef      = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const svg       = svgRef.current
    const container = containerRef.current
    if (!svg || !container || movements.length === 0) return

    // Clear previous render
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const W  = container.clientWidth
    const H  = Math.min(W, 620)
    const cx = W / 2
    const cy = H / 2
    const outerR = Math.min(cx, cy) - 90
    const innerR = outerR - 22

    svg.setAttribute('width',  String(W))
    svg.setAttribute('height', String(H))

    // ── matrix ──────────────────────────────────────────────────────────────
    const platforms = [
      ...new Set([...movements.map(m => m.from), ...movements.map(m => m.to)])
    ]
    const n   = platforms.length
    const idx = new Map(platforms.map((p, i) => [p, i]))

    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
    for (const m of movements) {
      matrix[idx.get(m.from)!][idx.get(m.to)!] += m.count
    }

    // ── d3-chord layout ──────────────────────────────────────────────────────
    const layout = d3chord().padAngle(0.05).sortSubgroups((a, b) => b.value - a.value)
    const chords = layout(matrix)

    const arcGen    = d3arc<ChordGroup>()
      .innerRadius(innerR).outerRadius(outerR)
    const ribbonGen = d3ribbon().radius(innerR - 1)

    const ns = 'http://www.w3.org/2000/svg'
    const g  = document.createElementNS(ns, 'g')
    g.setAttribute('transform', `translate(${cx},${cy})`)

    // ── ribbons (draw first so arcs sit on top) ───────────────────────────
    const ribbonGroup = document.createElementNS(ns, 'g')
    for (const chord of chords) {
      const srcPlatform = platforms[chord.source.index]
      const tgtPlatform = platforms[chord.target.index]
      const color       = platformColor(srcPlatform)

      const path = document.createElementNS(ns, 'path')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path.setAttribute('d', ribbonGen(chord as any) ?? '')
      path.setAttribute('fill', color)
      path.setAttribute('fill-opacity', '0.25')
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '0.5')
      path.setAttribute('stroke-opacity', '0.4')
      path.style.cursor = 'pointer'
      path.style.transition = 'fill-opacity 0.18s'

      path.addEventListener('mouseenter', () => {
        path.setAttribute('fill-opacity', '0.6')
        path.setAttribute('stroke-opacity', '0.8')
      })
      path.addEventListener('mouseleave', () => {
        path.setAttribute('fill-opacity', '0.25')
        path.setAttribute('stroke-opacity', '0.4')
      })
      path.addEventListener('click', () => {
        onFlowClick(srcPlatform, tgtPlatform, chord.source.value)
      })

      const title = document.createElementNS(ns, 'title')
      title.textContent =
        `${srcPlatform} → ${tgtPlatform}: ${chord.source.value.toLocaleString()} merchants`
      path.appendChild(title)
      ribbonGroup.appendChild(path)
    }
    g.appendChild(ribbonGroup)

    // ── arcs (platform segments) ─────────────────────────────────────────
    const arcGroup = document.createElementNS(ns, 'g')
    for (const group of chords.groups) {
      const platform = platforms[group.index]
      const color    = platformColor(platform)

      const path = document.createElementNS(ns, 'path')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path.setAttribute('d', arcGen(group as any) ?? '')
      path.setAttribute('fill', color)
      path.setAttribute('stroke', '#0f0f1a')
      path.setAttribute('stroke-width', '1.5')
      arcGroup.appendChild(path)

      // Label — position outside the arc
      const angle  = (group.startAngle + group.endAngle) / 2 - Math.PI / 2
      const labelR = outerR + 16
      const x      = labelR * Math.cos(angle)
      const y      = labelR * Math.sin(angle)
      const flip   = angle > Math.PI / 2 || angle < -Math.PI / 2

      const text = document.createElementNS(ns, 'text')
      text.setAttribute('x', String(x))
      text.setAttribute('y', String(y))
      text.setAttribute('dy', '0.35em')
      text.setAttribute('text-anchor', flip ? 'end' : 'start')
      text.setAttribute('fill', color)
      text.setAttribute('font-size', '11')
      text.setAttribute('font-family', 'Inter, system-ui, sans-serif')
      text.setAttribute(
        'transform',
        `rotate(${(angle * 180) / Math.PI}, ${x}, ${y})`
      )

      // Truncate long names
      const shortName = platform.replace(' Commerce', '').replace(' Cloud', '')
      text.textContent = shortName
      arcGroup.appendChild(text)

      // Tick value
      const total = group.value
      if (total > 0) {
        const tickR = outerR + 4
        const tx    = tickR * Math.cos(angle)
        const ty    = tickR * Math.sin(angle)
        const tick  = document.createElementNS(ns, 'text')
        tick.setAttribute('x', String(tx))
        tick.setAttribute('y', String(ty))
        tick.setAttribute('dy', '-0.3em')
        tick.setAttribute('text-anchor', 'middle')
        tick.setAttribute('fill', '#6b6b8a')
        tick.setAttribute('font-size', '9')
        tick.textContent = total > 999 ? `${(total / 1000).toFixed(1)}k` : String(total)
        arcGroup.appendChild(tick)
      }
    }
    g.appendChild(arcGroup)

    svg.appendChild(g)
  }, [movements, onFlowClick])

  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        No platform switches detected for this month.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full overflow-visible" />
    </div>
  )
}

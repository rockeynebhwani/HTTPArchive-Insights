'use client'

import { useEffect, useRef } from 'react'
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  SankeyGraph,
  SankeyNode,
  SankeyLink,
} from 'd3-sankey'
import { PLATFORM_COLORS } from '@/lib/colors'

export interface SankeyMovement {
  from: string
  to: string
  count: number
}

interface Props {
  movements: SankeyMovement[]
  onLinkClick: (from: string, to: string, count: number) => void
}

type NodeDatum = { name: string }
type LinkDatum = { count: number }

function nodeColor(name: string): string {
  return PLATFORM_COLORS[name] ?? '#6b6b8a'
}

export default function SankeyDiagram({ movements, onLinkClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container || movements.length === 0) return

    const W = container.clientWidth
    const H = Math.max(400, Math.min(600, movements.length * 30))
    svg.setAttribute('width', String(W))
    svg.setAttribute('height', String(H))

    // Clear previous render
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    // Build unique node list preserving left (from) and right (to) sides
    const fromNodes = [...new Set(movements.map(m => m.from))]
    const toNodes = [...new Set(movements.map(m => m.to))]
    const allNames = [...new Set([...fromNodes, ...toNodes])]
    const nodeIndex = new Map(allNames.map((n, i) => [n, i]))

    const graph: SankeyGraph<NodeDatum, LinkDatum> = {
      nodes: allNames.map(name => ({ name })),
      links: movements.map(m => ({
        source: nodeIndex.get(m.from)!,
        target: nodeIndex.get(m.to)!,
        value: m.count,
        count: m.count,
      })),
    }

    const sankeyGen = d3Sankey<NodeDatum, LinkDatum>()
      .nodeId(d => d.name)
      .nodeWidth(16)
      .nodePadding(14)
      .extent([[24, 24], [W - 24, H - 24]])

    const { nodes, links } = sankeyGen(graph)

    const ns = 'http://www.w3.org/2000/svg'

    // Defs for gradients
    const defs = document.createElementNS(ns, 'defs')
    links.forEach((link, i) => {
      const src = link.source as SankeyNode<NodeDatum, LinkDatum>
      const tgt = link.target as SankeyNode<NodeDatum, LinkDatum>
      const grad = document.createElementNS(ns, 'linearGradient')
      grad.setAttribute('id', `grad-${i}`)
      grad.setAttribute('gradientUnits', 'userSpaceOnUse')
      grad.setAttribute('x1', String(src.x1))
      grad.setAttribute('x2', String(tgt.x0))
      const stop1 = document.createElementNS(ns, 'stop')
      stop1.setAttribute('offset', '0%')
      stop1.setAttribute('stop-color', nodeColor(src.name))
      const stop2 = document.createElementNS(ns, 'stop')
      stop2.setAttribute('offset', '100%')
      stop2.setAttribute('stop-color', nodeColor(tgt.name))
      grad.appendChild(stop1)
      grad.appendChild(stop2)
      defs.appendChild(grad)
    })
    svg.appendChild(defs)

    // Links
    const linkGroup = document.createElementNS(ns, 'g')
    links.forEach((link, i) => {
      const src = link.source as SankeyNode<NodeDatum, LinkDatum>
      const tgt = link.target as SankeyNode<NodeDatum, LinkDatum>
      const path = document.createElementNS(ns, 'path')
      path.setAttribute('d', sankeyLinkHorizontal()(link as any) ?? '')
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', `url(#grad-${i})`)
      path.setAttribute('stroke-width', String(Math.max(2, link.width ?? 0)))
      path.setAttribute('stroke-opacity', '0.35')
      path.style.cursor = 'pointer'
      path.style.transition = 'stroke-opacity 0.2s'

      path.addEventListener('mouseenter', () => path.setAttribute('stroke-opacity', '0.7'))
      path.addEventListener('mouseleave', () => path.setAttribute('stroke-opacity', '0.35'))
      path.addEventListener('click', () => {
        onLinkClick(src.name, tgt.name, (link as any).count)
      })

      // Tooltip title
      const title = document.createElementNS(ns, 'title')
      title.textContent = `${src.name} → ${tgt.name}: ${(link as any).count.toLocaleString()} merchants`
      path.appendChild(title)

      linkGroup.appendChild(path)
    })
    svg.appendChild(linkGroup)

    // Nodes
    const nodeGroup = document.createElementNS(ns, 'g')
    nodes.forEach(node => {
      const rect = document.createElementNS(ns, 'rect')
      rect.setAttribute('x', String(node.x0))
      rect.setAttribute('y', String(node.y0))
      rect.setAttribute('width', String(node.x1! - node.x0!))
      rect.setAttribute('height', String(Math.max(4, node.y1! - node.y0!)))
      rect.setAttribute('fill', nodeColor(node.name))
      rect.setAttribute('rx', '3')
      nodeGroup.appendChild(rect)

      // Label
      const text = document.createElementNS(ns, 'text')
      const onLeft = node.x0! < W / 2
      text.setAttribute('x', String(onLeft ? node.x1! + 6 : node.x0! - 6))
      text.setAttribute('y', String((node.y0! + node.y1!) / 2))
      text.setAttribute('dy', '0.35em')
      text.setAttribute('text-anchor', onLeft ? 'start' : 'end')
      text.setAttribute('fill', '#e2e2e8')
      text.setAttribute('font-size', '11')
      text.setAttribute('font-family', 'Inter, system-ui, sans-serif')
      text.textContent = `${node.name} (${(node.value ?? 0).toLocaleString()})`
      nodeGroup.appendChild(text)
    })
    svg.appendChild(nodeGroup)
  }, [movements, onLinkClick])

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

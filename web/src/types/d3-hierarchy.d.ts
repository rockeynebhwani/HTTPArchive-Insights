declare module 'd3-hierarchy' {
  export interface HierarchyNode<Datum> {
    data: Datum
    depth: number
    height: number
    parent: HierarchyNode<Datum> | null
    children?: HierarchyNode<Datum>[]
    value?: number
    x?: number
    y?: number
    r?: number
    leaves(): HierarchyNode<Datum>[]
    sum(value: (d: Datum) => number): this
    sort(compare: (a: HierarchyNode<Datum>, b: HierarchyNode<Datum>) => number): this
  }

  export interface PackLayout<Datum> {
    (root: HierarchyNode<Datum>): HierarchyNode<Datum>
    size(): [number, number]
    size(size: [number, number]): this
    padding(): number | ((node: HierarchyNode<Datum>) => number)
    padding(padding: number | ((node: HierarchyNode<Datum>) => number)): this
    radius(): ((node: HierarchyNode<Datum>) => number) | null
    radius(radius: null | ((node: HierarchyNode<Datum>) => number)): this
  }

  export function hierarchy<Datum>(data: Datum, children?: (d: Datum) => Datum[] | null | undefined): HierarchyNode<Datum>
  export function pack<Datum>(): PackLayout<Datum>
}

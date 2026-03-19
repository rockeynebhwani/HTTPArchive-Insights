declare module 'd3-chord' {
  export interface ChordSubgroup {
    startAngle: number
    endAngle: number
    value: number
    index: number
  }

  export interface Chord {
    source: ChordSubgroup
    target: ChordSubgroup
  }

  export interface ChordGroup {
    startAngle: number
    endAngle: number
    value: number
    index: number
  }

  export interface Chords extends Array<Chord> {
    groups: ChordGroup[]
  }

  export interface ChordLayout {
    (matrix: number[][]): Chords
    padAngle(): number
    padAngle(angle: number): this
    sortGroups(compare: ((a: ChordGroup, b: ChordGroup) => number) | null): this
    sortSubgroups(compare: ((a: ChordSubgroup, b: ChordSubgroup) => number) | null): this
    sortChords(compare: ((a: Chord, b: Chord) => number) | null): this
  }

  export interface RibbonGenerator {
    (chord: Chord): string
    source(): (d: Chord) => ChordSubgroup
    target(): (d: Chord) => ChordSubgroup
    radius(r: number): this
    radius(): number
    startAngle(fn: (d: ChordSubgroup) => number): this
    endAngle(fn: (d: ChordSubgroup) => number): this
  }

  export function chord(): ChordLayout
  export function ribbon(): RibbonGenerator
}

import { describe, it, expect } from 'vitest'
import { CausalTree, node, or, and, combine, computeNode } from '../src/index.js'

// ── Core arithmetic ───────────────────────────────────────

describe('CausalTree.compute', () => {
  it('OR of two leaves: 1 - (1-A)(1-B)', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    expect(tree.compute()).toBeCloseTo(0.58, 5)
  })

  it('AND of two leaves: A * B', () => {
    const tree = new CausalTree('Test', 'and')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    expect(tree.compute()).toBeCloseTo(0.12, 5)
  })

  it('single-leaf OR returns the leaf probability', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.42))
    expect(tree.compute()).toBeCloseTo(0.42, 5)
  })

  it('single-leaf AND returns the leaf probability', () => {
    const tree = new CausalTree('Test', 'and')
    tree.add(node('A', 0.42))
    expect(tree.compute()).toBeCloseTo(0.42, 5)
  })

  it('nested OR-of-OR collapses correctly', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(or('Supply disruption', 0.3, [node('Hormuz', 0.15), node('Russia cuts', 0.2)]))
    tree.add(node('OPEC cuts', 0.25))
    // Inner OR(0.15, 0.2) = 1 - 0.85*0.8 = 0.32
    // Outer OR(0.32, 0.25) = 1 - 0.68*0.75 = 0.49
    expect(tree.compute()).toBeCloseTo(0.49, 2)
  })

  it('AND inside OR', () => {
    const tree = new CausalTree('Combined')
    tree.add(and('Both must hit', 0, [node('A', 0.5), node('B', 0.5)]))
    tree.add(node('Or this', 0.2))
    // AND(0.5, 0.5) = 0.25; OR(0.25, 0.2) = 1 - 0.75*0.8 = 0.4
    expect(tree.compute()).toBeCloseTo(0.4, 5)
  })
})

describe('computeNode (probability clamping)', () => {
  it('clamps probability above 1 to 1', () => {
    expect(computeNode({ label: 'over', probability: 1.5 })).toBe(1)
  })

  it('clamps negative probability to 0', () => {
    expect(computeNode({ label: 'under', probability: -0.3 })).toBe(0)
  })

  it('handles probability 0 leaf', () => {
    expect(computeNode({ label: 'never', probability: 0 })).toBe(0)
  })

  it('handles probability 1 leaf', () => {
    expect(computeNode({ label: 'certain', probability: 1 })).toBe(1)
  })
})

describe('combine() helper', () => {
  it('OR combines independent nodes', () => {
    expect(combine([{ label: 'a', probability: 0.5 }, { label: 'b', probability: 0.5 }])).toBeCloseTo(0.75, 5)
  })

  it('AND combines independent nodes', () => {
    expect(
      combine([{ label: 'a', probability: 0.5 }, { label: 'b', probability: 0.5 }], 'and'),
    ).toBeCloseTo(0.25, 5)
  })

  it('empty input → 0 for OR (vacuous false)', () => {
    expect(combine([])).toBe(0)
  })

  it('empty input → 1 for AND (vacuous true)', () => {
    expect(combine([], 'and')).toBe(1)
  })
})

// ── Sensitivity ───────────────────────────────────────────

describe('sensitivity', () => {
  it('returns one row per leaf, sorted by impact descending', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.8))
    const sens = tree.sensitivity()
    expect(sens).toHaveLength(2)
    expect(sens[0].impact).toBeGreaterThanOrEqual(sens[1].impact)
    expect(sens.map((s) => s.label).sort()).toEqual(['A', 'B'])
  })

  it('walks into nested children', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(or('Supply', 0, [node('Hormuz', 0.15), node('Russia cuts', 0.2)]))
    tree.add(node('OPEC cuts', 0.25))
    const sens = tree.sensitivity()
    expect(sens.map((s) => s.label).sort()).toEqual(['Hormuz', 'OPEC cuts', 'Russia cuts'])
  })

  it('does not mutate original probabilities', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.8))
    tree.sensitivity()
    expect(tree.compute()).toBeCloseTo(1 - 0.7 * 0.2, 5)
  })
})

// ── whatIf ────────────────────────────────────────────────

describe('whatIf', () => {
  it('computes counterfactual delta', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    const result = tree.whatIf('A', 0.9)
    expect(result.probability).toBeGreaterThan(0.58)
    expect(result.delta).toBeGreaterThan(0)
  })

  it('does not mutate the original tree', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    const before = tree.compute()
    tree.whatIf('A', 0.9)
    expect(tree.compute()).toBeCloseTo(before, 5)
  })

  it('finds nodes inside nested children', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(or('Supply', 0, [node('Hormuz', 0.15), node('Russia cuts', 0.2)]))
    const result = tree.whatIf('Hormuz', 0.95)
    expect(result.delta).toBeGreaterThan(0)
  })

  it('throws on missing label', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3))
    expect(() => tree.whatIf('Z', 0.5)).toThrow(/not found/)
  })
})

// ── Serialization ─────────────────────────────────────────

describe('serialization', () => {
  it('round-trips a flat tree', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3))
    const restored = CausalTree.fromJSON(tree.toJSON())
    expect(restored.compute()).toBeCloseTo(tree.compute(), 5)
  })

  it('round-trips a nested tree', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(or('Supply', 0, [node('Hormuz', 0.15), node('Russia cuts', 0.2)]))
    tree.add(node('OPEC cuts', 0.25))
    const json = tree.toJSON()
    const restored = CausalTree.fromJSON(JSON.parse(JSON.stringify(json)))
    expect(restored.compute()).toBeCloseTo(tree.compute(), 5)
    expect(restored.title).toBe('Oil > $100')
  })

  it('preserves the operator', () => {
    const tree = new CausalTree('Test', 'and')
    tree.add(node('A', 0.5))
    const restored = CausalTree.fromJSON(tree.toJSON())
    expect(restored.operator).toBe('and')
  })
})

// ── Pretty print ──────────────────────────────────────────

describe('toString', () => {
  it('includes the title and the headline percentage', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(node('Supply', 0.3)).add(node('Demand', 0.4))
    const str = tree.toString()
    expect(str).toContain('Oil > $100')
    expect(str).toContain('Supply')
    expect(str).toMatch(/58%/)
  })
})

// ── Flatten ───────────────────────────────────────────────

describe('flatten', () => {
  it('returns one entry per leaf', () => {
    const tree = new CausalTree('Test')
    tree.add(or('Branch', 0, [node('A', 0.1), node('B', 0.2)]))
    tree.add(node('C', 0.3))
    expect(tree.flatten()).toEqual([
      { label: 'A', probability: 0.1 },
      { label: 'B', probability: 0.2 },
      { label: 'C', probability: 0.3 },
    ])
  })
})

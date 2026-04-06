import { describe, it, expect } from 'vitest'
import { CausalTree, node, or, and } from '../src/index.js'

describe('CausalTree', () => {
  it('computes OR probability', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    // 1 - (0.7 * 0.6) = 0.58
    expect(tree.compute()).toBeCloseTo(0.58, 2)
  })

  it('computes AND probability', () => {
    const tree = new CausalTree('Test', 'and')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    expect(tree.compute()).toBeCloseTo(0.12, 2)
  })

  it('computes nested tree', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(or('Supply disruption', 0.3, [node('Hormuz', 0.15), node('Russia cuts', 0.2)]))
    tree.add(node('OPEC cuts', 0.25))
    const p = tree.compute()
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })

  it('sensitivity analysis returns sorted results', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.8))
    const sens = tree.sensitivity()
    expect(sens.length).toBe(2)
    expect(sens[0].impact).toBeGreaterThanOrEqual(sens[1].impact)
  })

  it('whatIf analysis', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3)).add(node('B', 0.4))
    const result = tree.whatIf('A', 0.9)
    expect(result.probability).toBeGreaterThan(0.58)
    expect(result.delta).toBeGreaterThan(0)
  })

  it('serializes and deserializes', () => {
    const tree = new CausalTree('Test')
    tree.add(node('A', 0.3))
    const json = tree.toJSON()
    const restored = CausalTree.fromJSON(json)
    expect(restored.compute()).toBeCloseTo(tree.compute(), 5)
  })

  it('toString produces readable output', () => {
    const tree = new CausalTree('Oil > $100')
    tree.add(node('Supply', 0.3)).add(node('Demand', 0.4))
    const str = tree.toString()
    expect(str).toContain('Oil > $100')
    expect(str).toContain('Supply')
  })
})

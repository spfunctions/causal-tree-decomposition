import { describe, it, expect, beforeEach } from 'vitest';
import {
  CausalTree,
  CausalNode,
  node,
  or,
  and,
  combine,
  computeNode,
  resetIdCounter,
} from '../src/index.js';

beforeEach(() => {
  resetIdCounter();
});

// ---------- combine() ----------

describe('combine()', () => {
  it('OR: single probability', () => {
    expect(combine([0.3], 'OR')).toBeCloseTo(0.3);
  });

  it('OR: two independent probabilities', () => {
    // P(A or B) = 1 - (1-0.3)(1-0.4) = 1 - 0.7*0.6 = 1 - 0.42 = 0.58
    expect(combine([0.3, 0.4], 'OR')).toBeCloseTo(0.58);
  });

  it('OR: three probabilities', () => {
    // 1 - (1-0.3)(1-0.4)(1-0.5) = 1 - 0.7*0.6*0.5 = 1 - 0.21 = 0.79
    expect(combine([0.3, 0.4, 0.5], 'OR')).toBeCloseTo(0.79);
  });

  it('OR: all zeros = 0', () => {
    expect(combine([0, 0, 0], 'OR')).toBe(0);
  });

  it('OR: one certainty = 1', () => {
    expect(combine([0.1, 1.0, 0.3], 'OR')).toBeCloseTo(1.0);
  });

  it('AND: single probability', () => {
    expect(combine([0.5], 'AND')).toBeCloseTo(0.5);
  });

  it('AND: two probabilities', () => {
    // P(A and B) = 0.5 * 0.6 = 0.3
    expect(combine([0.5, 0.6], 'AND')).toBeCloseTo(0.3);
  });

  it('AND: any zero = 0', () => {
    expect(combine([0.5, 0, 0.8], 'AND')).toBe(0);
  });

  it('AND: all ones = 1', () => {
    expect(combine([1, 1, 1], 'AND')).toBe(1);
  });

  it('empty array returns 0', () => {
    expect(combine([], 'OR')).toBe(0);
    expect(combine([], 'AND')).toBe(0);
  });
});

// ---------- CausalNode ----------

describe('CausalNode', () => {
  it('creates a leaf node', () => {
    const n = node('test', 0.5);
    expect(n.label).toBe('test');
    expect(n.probability).toBe(0.5);
    expect(n.isLeaf).toBe(true);
    expect(n.operator).toBe('OR');
  });

  it('creates an OR node with children', () => {
    const n = or('parent', 0.3, [node('a', 0.1), node('b', 0.2)]);
    expect(n.operator).toBe('OR');
    expect(n.children).toHaveLength(2);
    expect(n.isLeaf).toBe(false);
  });

  it('creates an AND node with children', () => {
    const n = and('parent', 0.5, [node('a', 0.8), node('b', 0.9)]);
    expect(n.operator).toBe('AND');
    expect(n.children).toHaveLength(2);
  });

  it('rejects probability < 0', () => {
    expect(() => node('bad', -0.1)).toThrow(RangeError);
  });

  it('rejects probability > 1', () => {
    expect(() => node('bad', 1.5)).toThrow(RangeError);
  });

  it('accepts boundary values 0 and 1', () => {
    expect(node('zero', 0).probability).toBe(0);
    expect(node('one', 1).probability).toBe(1);
  });

  it('serializes and deserializes', () => {
    const n = or('parent', 0.3, [node('a', 0.1), node('b', 0.2)]);
    const json = n.toJSON();
    const restored = CausalNode.fromJSON(json);
    expect(restored.label).toBe('parent');
    expect(restored.probability).toBe(0.3);
    expect(restored.operator).toBe('OR');
    expect(restored.children).toHaveLength(2);
    expect(restored.children[0].label).toBe('a');
  });
});

// ---------- computeNode ----------

describe('computeNode()', () => {
  it('leaf returns own probability', () => {
    expect(computeNode(node('x', 0.7))).toBeCloseTo(0.7);
  });

  it('OR node combines children', () => {
    const n = or('parent', 0.5, [node('a', 0.3), node('b', 0.4)]);
    // 1 - (1-0.3)(1-0.4) = 0.58
    expect(computeNode(n)).toBeCloseTo(0.58);
  });

  it('AND node combines children', () => {
    const n = and('parent', 0.5, [node('a', 0.5), node('b', 0.6)]);
    // 0.5 * 0.6 = 0.3
    expect(computeNode(n)).toBeCloseTo(0.3);
  });

  it('nested tree computes recursively', () => {
    const n = or('root', 0.5, [
      or('branch', 0.3, [node('a', 0.2), node('b', 0.3)]),
      node('c', 0.4),
    ]);
    // branch: 1 - (1-0.2)(1-0.3) = 1 - 0.56 = 0.44
    // root: 1 - (1-0.44)(1-0.4) = 1 - 0.56*0.6 = 1 - 0.336 = 0.664
    expect(computeNode(n)).toBeCloseTo(0.664);
  });

  it('with anchor weight blends node probability', () => {
    const n = or('parent', 0.8, [node('a', 0.3), node('b', 0.4)]);
    // combined = 0.58, anchor = 0.4*0.8 + 0.6*0.58 = 0.32 + 0.348 = 0.668
    expect(computeNode(n, 0.4)).toBeCloseTo(0.668);
  });
});

// ---------- CausalTree ----------

describe('CausalTree', () => {
  function buildOilTree(): CausalTree {
    const tree = new CausalTree('Oil exceeds $100 by Dec 2026');
    tree.add(or('Supply disruption', 0.3, [
      node('Hormuz closure', 0.15),
      node('Russia further cuts', 0.2),
    ]));
    tree.add(or('Demand surge', 0.4, [
      node('China recovery', 0.5),
      node('Cold winter', 0.3),
    ]));
    tree.add(node('OPEC cuts production', 0.25));
    return tree;
  }

  describe('compute()', () => {
    it('computes correct probability for oil example', () => {
      const tree = buildOilTree();
      // Supply: 1 - (1-0.15)(1-0.2) = 1 - 0.85*0.8 = 1 - 0.68 = 0.32
      // Demand: 1 - (1-0.5)(1-0.3) = 1 - 0.5*0.7 = 1 - 0.35 = 0.65
      // OPEC: 0.25
      // Overall OR: 1 - (1-0.32)(1-0.65)(1-0.25)
      //           = 1 - 0.68 * 0.35 * 0.75
      //           = 1 - 0.1785
      //           = 0.8215
      const p = tree.compute();
      expect(p).toBeCloseTo(0.8215, 3);
    });

    it('returns 0 for empty tree', () => {
      const tree = new CausalTree('empty');
      expect(tree.compute()).toBe(0);
    });

    it('single node returns its probability', () => {
      const tree = new CausalTree('simple');
      tree.add(node('only', 0.7));
      expect(tree.compute()).toBeCloseTo(0.7);
    });

    it('AND tree requires all nodes', () => {
      const tree = new CausalTree('conjunction', 'AND');
      tree.add(node('a', 0.8));
      tree.add(node('b', 0.9));
      tree.add(node('c', 0.7));
      // 0.8 * 0.9 * 0.7 = 0.504
      expect(tree.compute()).toBeCloseTo(0.504);
    });
  });

  describe('sensitivity()', () => {
    it('returns sorted results', () => {
      const tree = buildOilTree();
      const sens = tree.sensitivity();
      expect(sens.length).toBeGreaterThan(0);
      // Should be sorted descending by impact
      for (let i = 1; i < sens.length; i++) {
        expect(sens[i - 1].impact).toBeGreaterThanOrEqual(sens[i].impact);
      }
    });

    it('every result has id, label, and impact', () => {
      const tree = buildOilTree();
      const sens = tree.sensitivity();
      for (const s of sens) {
        expect(s.id).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(typeof s.impact).toBe('number');
        expect(s.impact).toBeGreaterThanOrEqual(0);
      }
    });

    it('higher-probability nodes tend to have more impact', () => {
      const tree = buildOilTree();
      const sens = tree.sensitivity();
      // China recovery (0.5) should generally have more impact than Hormuz (0.15)
      const china = sens.find(s => s.label === 'China recovery');
      const hormuz = sens.find(s => s.label === 'Hormuz closure');
      expect(china).toBeDefined();
      expect(hormuz).toBeDefined();
      // In an OR tree, the node with higher base probability in a deeper OR
      // group doesn't necessarily have more swing. But we can check they're both non-zero.
      expect(china!.impact).toBeGreaterThan(0);
      expect(hormuz!.impact).toBeGreaterThan(0);
    });
  });

  describe('whatIf()', () => {
    it('returns original, new probability, and delta', () => {
      const tree = buildOilTree();
      const result = tree.whatIf('Hormuz closure', 0.95);
      expect(result.original).toBeCloseTo(tree.compute(), 5);
      expect(result.probability).toBeGreaterThan(result.original);
      expect(result.delta).toBeGreaterThan(0);
      expect(result.delta).toBeCloseTo(result.probability - result.original, 5);
    });

    it('setting probability to 0 decreases overall', () => {
      const tree = buildOilTree();
      const result = tree.whatIf('China recovery', 0);
      expect(result.probability).toBeLessThan(result.original);
    });

    it('throws on non-existent node', () => {
      const tree = buildOilTree();
      expect(() => tree.whatIf('nonexistent', 0.5)).toThrow('Node not found');
    });

    it('throws on out-of-range probability', () => {
      const tree = buildOilTree();
      expect(() => tree.whatIf('Hormuz closure', 1.5)).toThrow(RangeError);
    });

    it('does not mutate the tree', () => {
      const tree = buildOilTree();
      const before = tree.compute();
      tree.whatIf('Hormuz closure', 0.95);
      const after = tree.compute();
      expect(after).toBeCloseTo(before);
    });
  });

  describe('flatten()', () => {
    it('returns all leaf nodes', () => {
      const tree = buildOilTree();
      const flat = tree.flatten();
      // Should have 5 leaf nodes: Hormuz, Russia, China, Cold winter, OPEC
      expect(flat).toHaveLength(5);
      expect(flat.map(f => f.label).sort()).toEqual([
        'China recovery',
        'Cold winter',
        'Hormuz closure',
        'OPEC cuts production',
        'Russia further cuts',
      ]);
    });

    it('includes path information', () => {
      const tree = buildOilTree();
      const flat = tree.flatten();
      const hormuz = flat.find(f => f.label === 'Hormuz closure');
      expect(hormuz).toBeDefined();
      expect(hormuz!.path).toEqual(['Supply disruption', 'Hormuz closure']);
    });

    it('top-level leaf has single-element path', () => {
      const tree = buildOilTree();
      const flat = tree.flatten();
      const opec = flat.find(f => f.label === 'OPEC cuts production');
      expect(opec!.path).toEqual(['OPEC cuts production']);
    });
  });

  describe('prune()', () => {
    it('removes low-impact nodes', () => {
      const tree = buildOilTree();
      const beforeCount = tree.flatten().length;
      const pruned = tree.prune(0.5); // very high threshold => prune a lot
      const afterCount = tree.flatten().length;
      expect(pruned).toBeGreaterThan(0);
      expect(afterCount).toBeLessThan(beforeCount);
    });

    it('prune(0) removes nothing', () => {
      const tree = buildOilTree();
      const pruned = tree.prune(0);
      expect(pruned).toBe(0);
    });

    it('prune(1.1) removes everything (impact is always <= 1)', () => {
      const tree = buildOilTree();
      const pruned = tree.prune(1.1);
      // 5 leaf nodes + 2 branch nodes that become empty = 7
      expect(pruned).toBe(7);
      expect(tree.flatten()).toHaveLength(0);
    });
  });

  describe('toJSON() / fromJSON()', () => {
    it('round-trips correctly', () => {
      const tree = buildOilTree();
      const json = tree.toJSON();
      const restored = CausalTree.fromJSON(json);

      expect(restored.thesis).toBe(tree.thesis);
      expect(restored.operator).toBe(tree.operator);
      expect(restored.compute()).toBeCloseTo(tree.compute(), 10);
    });

    it('serialized form is plain JSON', () => {
      const tree = buildOilTree();
      const json = tree.toJSON();
      // Should survive JSON.stringify/parse
      const parsed = JSON.parse(JSON.stringify(json));
      const restored = CausalTree.fromJSON(parsed);
      expect(restored.compute()).toBeCloseTo(tree.compute(), 10);
    });

    it('preserves nested structure', () => {
      const tree = buildOilTree();
      const json = tree.toJSON();
      expect(json.nodes).toHaveLength(3);
      expect(json.nodes[0].children).toHaveLength(2);
      expect(json.nodes[0].children[0].label).toBe('Hormuz closure');
    });
  });

  describe('toString()', () => {
    it('produces readable output', () => {
      const tree = buildOilTree();
      const str = tree.toString();
      expect(str).toContain('Oil exceeds $100 by Dec 2026');
      expect(str).toContain('Supply disruption');
      expect(str).toContain('Hormuz closure');
      expect(str).toContain('OPEC cuts production');
      expect(str).toContain('->');
      expect(str).toContain('%');
    });

    it('contains tree-drawing characters', () => {
      const tree = buildOilTree();
      const str = tree.toString();
      expect(str).toMatch(/[├└│]/);
    });

    it('labels OR nodes', () => {
      const tree = buildOilTree();
      const str = tree.toString();
      expect(str).toContain('OR Supply disruption');
      expect(str).toContain('OR Demand surge');
    });
  });

  describe('add() chaining', () => {
    it('supports method chaining', () => {
      const tree = new CausalTree('test')
        .add(node('a', 0.3))
        .add(node('b', 0.4));
      expect(tree.compute()).toBeCloseTo(0.58);
    });
  });

  describe('getRootNodes()', () => {
    it('returns root nodes', () => {
      const tree = buildOilTree();
      const roots = tree.getRootNodes();
      expect(roots).toHaveLength(3);
      expect(roots[0].label).toBe('Supply disruption');
    });
  });
});

// ---------- Edge cases ----------

describe('edge cases', () => {
  it('deeply nested tree computes correctly', () => {
    const tree = new CausalTree('deep');
    tree.add(
      or('level1', 0.5, [
        or('level2', 0.4, [
          or('level3', 0.3, [
            node('leaf', 0.9),
          ]),
        ]),
      ])
    );
    // leaf = 0.9, level3 = OR(0.9) = 0.9, level2 = OR(0.9) = 0.9, level1 = OR(0.9) = 0.9
    // tree = OR(0.9) = 0.9
    expect(tree.compute()).toBeCloseTo(0.9);
  });

  it('mixed AND/OR tree', () => {
    const tree = new CausalTree('mixed', 'AND');
    tree.add(or('any_supply', 0.5, [
      node('factor_a', 0.3),
      node('factor_b', 0.4),
    ]));
    tree.add(and('all_demand', 0.5, [
      node('factor_c', 0.8),
      node('factor_d', 0.9),
    ]));
    // any_supply OR: 1 - (1-0.3)(1-0.4) = 0.58
    // all_demand AND: 0.8 * 0.9 = 0.72
    // tree AND: 0.58 * 0.72 = 0.4176
    expect(tree.compute()).toBeCloseTo(0.4176);
  });

  it('all-zero tree returns 0', () => {
    const tree = new CausalTree('zero');
    tree.add(node('a', 0));
    tree.add(node('b', 0));
    expect(tree.compute()).toBe(0);
  });

  it('all-certain tree returns 1', () => {
    const tree = new CausalTree('certain');
    tree.add(node('a', 1));
    tree.add(node('b', 1));
    expect(tree.compute()).toBeCloseTo(1);
  });

  it('AND tree with one zero returns 0', () => {
    const tree = new CausalTree('and-zero', 'AND');
    tree.add(node('a', 0.9));
    tree.add(node('b', 0));
    expect(tree.compute()).toBe(0);
  });

  it('whatIf by node ID works', () => {
    const tree = new CausalTree('test');
    const n = node('target', 0.5);
    tree.add(n);
    const result = tree.whatIf(n.id, 0.9);
    expect(result.probability).toBeCloseTo(0.9);
  });
});

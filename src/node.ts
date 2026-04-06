/**
 * CausalNode: a single node in a causal tree.
 *
 * Each node has a label, probability, an operator (AND/OR) for combining
 * children, and zero or more child nodes.
 */

import type { Operator, NodeConfig } from './types.js';

let idCounter = 0;

/** Reset the internal ID counter (useful for tests). */
export function resetIdCounter(): void {
  idCounter = 0;
}

export class CausalNode {
  readonly id: string;
  readonly label: string;
  probability: number;
  readonly operator: Operator;
  readonly children: CausalNode[];

  constructor(label: string, probability: number, operator: Operator = 'OR', children: CausalNode[] = []) {
    if (probability < 0 || probability > 1) {
      throw new RangeError(`Probability must be between 0 and 1, got ${probability}`);
    }
    this.id = `n${++idCounter}`;
    this.label = label;
    this.probability = probability;
    this.operator = operator;
    this.children = children;
  }

  /** Whether this node has children */
  get isLeaf(): boolean {
    return this.children.length === 0;
  }

  /** Serialize to a plain object */
  toJSON(): NodeConfig {
    return {
      id: this.id,
      label: this.label,
      probability: this.probability,
      operator: this.operator,
      children: this.children.map(c => c.toJSON()),
    };
  }

  /** Restore from a plain object */
  static fromJSON(config: NodeConfig): CausalNode {
    const children = (config.children || []).map(c => CausalNode.fromJSON(c));
    const n = new CausalNode(config.label, config.probability, config.operator, children);
    // Override the auto-generated ID with the serialized one
    (n as { id: string }).id = config.id;
    return n;
  }
}

// --- Builder functions ---

/**
 * Create a simple leaf node (defaults to OR operator, no children).
 */
export function node(label: string, probability: number): CausalNode {
  return new CausalNode(label, probability, 'OR', []);
}

/**
 * Create an OR node: thesis is true if ANY child is true.
 * P = 1 - product(1 - P(child_i))
 */
export function or(label: string, probability: number, children: CausalNode[] = []): CausalNode {
  return new CausalNode(label, probability, 'OR', children);
}

/**
 * Create an AND node: thesis is true only if ALL children are true.
 * P = product(P(child_i))
 */
export function and(label: string, probability: number, children: CausalNode[] = []): CausalNode {
  return new CausalNode(label, probability, 'AND', children);
}

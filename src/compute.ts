/**
 * Probability computation engine.
 *
 * Core functions for combining probabilities in a causal tree
 * using AND/OR Bayesian logic.
 */

import { CausalNode } from './node.js';
import type { Operator } from './types.js';

/**
 * Combine child probabilities using the given operator.
 *
 * OR:  P = 1 - product(1 - P_i)   (at least one is true)
 * AND: P = product(P_i)            (all must be true)
 */
export function combine(probabilities: number[], operator: Operator): number {
  if (probabilities.length === 0) return 0;

  if (operator === 'AND') {
    return probabilities.reduce((acc, p) => acc * p, 1);
  }

  // OR: 1 - product of complements
  return 1 - probabilities.reduce((acc, p) => acc * (1 - p), 1);
}

/**
 * Recursively compute the effective probability of a node.
 *
 * - Leaf node: returns its own probability.
 * - Branch node with children: combines children using the node's operator,
 *   then blends with the node's own probability as an anchor.
 *   The node's own probability acts as a prior / base rate.
 *   Effective = anchor_weight * node.probability + (1 - anchor_weight) * combined_children
 *
 * We use anchor_weight = 0 by default (pure bottom-up), meaning the node's
 * own probability is only used when it has no children. If you want the node's
 * probability to act as a prior that tempers the children, pass anchorWeight > 0.
 */
export function computeNode(n: CausalNode, anchorWeight: number = 0): number {
  if (n.isLeaf) {
    return n.probability;
  }

  const childProbs = n.children.map(c => computeNode(c, anchorWeight));
  const combined = combine(childProbs, n.operator);

  if (anchorWeight > 0) {
    return anchorWeight * n.probability + (1 - anchorWeight) * combined;
  }

  return combined;
}

/**
 * Compute sensitivity for a single node by measuring the delta in overall
 * tree probability when this node's probability swings from 0 to 1.
 *
 * @param allNodes  All root-level nodes of the tree
 * @param rootOperator  The tree's root operator
 * @param targetId  The node ID to test
 * @param anchorWeight  Anchor weight for compute
 * @returns The absolute impact (P_high - P_low)
 */
export function sensitivity(
  allNodes: CausalNode[],
  rootOperator: Operator,
  targetId: string,
  anchorWeight: number = 0,
): number {
  // Save original probability
  const target = findNode(allNodes, targetId);
  if (!target) return 0;

  const original = target.probability;

  // Compute with probability = 0
  target.probability = 0;
  const pLow = combine(allNodes.map(n => computeNode(n, anchorWeight)), rootOperator);

  // Compute with probability = 1
  target.probability = 1;
  const pHigh = combine(allNodes.map(n => computeNode(n, anchorWeight)), rootOperator);

  // Restore
  target.probability = original;

  return Math.abs(pHigh - pLow);
}

/**
 * Compute what-if: what happens to the overall probability if a specific
 * node's probability changes to a new value?
 */
export function whatIf(
  allNodes: CausalNode[],
  rootOperator: Operator,
  targetId: string,
  newProbability: number,
  anchorWeight: number = 0,
): { original: number; probability: number; delta: number } {
  if (newProbability < 0 || newProbability > 1) {
    throw new RangeError(`Probability must be between 0 and 1, got ${newProbability}`);
  }

  const target = findNode(allNodes, targetId);
  if (!target) {
    throw new Error(`Node not found: ${targetId}`);
  }

  const originalProb = target.probability;

  // Current overall probability
  const original = combine(allNodes.map(n => computeNode(n, anchorWeight)), rootOperator);

  // Modified overall probability
  target.probability = newProbability;
  const probability = combine(allNodes.map(n => computeNode(n, anchorWeight)), rootOperator);

  // Restore
  target.probability = originalProb;

  return {
    original: round(original),
    probability: round(probability),
    delta: round(probability - original),
  };
}

/**
 * Find a node by ID anywhere in the tree (DFS).
 */
function findNode(nodes: CausalNode[], id: string): CausalNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children.length > 0) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Round to 10 decimal places to avoid floating point noise */
function round(n: number): number {
  return Math.round(n * 1e10) / 1e10;
}

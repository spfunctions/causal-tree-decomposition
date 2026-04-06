/**
 * causal-tree-decomposition
 *
 * A standalone probability engine that decomposes complex predictions
 * into causal trees. Zero dependencies, pure TypeScript.
 *
 * @example
 * ```ts
 * import { CausalTree, node, or, and } from 'causal-tree-decomposition'
 *
 * const tree = new CausalTree('Oil exceeds $100 by Dec 2026')
 * tree.add(or('Supply disruption', 0.3, [
 *   node('Hormuz closure', 0.15),
 *   node('Russia further cuts', 0.2),
 * ]))
 * tree.add(node('OPEC cuts production', 0.25))
 *
 * console.log(tree.compute())     // combined probability
 * console.log(tree.sensitivity()) // which nodes matter most
 * console.log(tree.toString())    // pretty-printed tree
 * ```
 */

export { CausalTree } from './tree.js';
export { CausalNode, node, or, and, resetIdCounter } from './node.js';
export { combine, computeNode } from './compute.js';
export type {
  Operator,
  NodeConfig,
  SerializedTree,
  SensitivityResult,
  WhatIfResult,
  FlatNode,
} from './types.js';

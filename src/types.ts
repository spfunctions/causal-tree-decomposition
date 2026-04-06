/**
 * TypeScript interfaces for causal tree decomposition.
 */

/** Logical operator for combining child node probabilities */
export type Operator = 'AND' | 'OR';

/** Configuration for a single causal node */
export interface NodeConfig {
  id: string;
  label: string;
  probability: number;
  operator: Operator;
  children: NodeConfig[];
}

/** Serialized tree format (for JSON storage/transmission) */
export interface SerializedTree {
  thesis: string;
  operator: Operator;
  nodes: NodeConfig[];
}

/** Result of sensitivity analysis for a single node */
export interface SensitivityResult {
  id: string;
  label: string;
  /** Change in overall probability when this node goes from 0 to 1 */
  impact: number;
}

/** Result of a what-if computation */
export interface WhatIfResult {
  /** Original tree probability */
  original: number;
  /** Probability with the modified node */
  probability: number;
  /** Difference (probability - original) */
  delta: number;
}

/** Flat representation of a leaf node */
export interface FlatNode {
  id: string;
  label: string;
  probability: number;
  path: string[];
}

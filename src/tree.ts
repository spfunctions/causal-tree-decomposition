/**
 * CausalTree: the top-level container for a causal decomposition.
 *
 * Build a tree, compute probabilities, run sensitivity analysis,
 * and serialize/deserialize.
 */

import { CausalNode } from './node.js';
import { combine, computeNode, sensitivity as computeSensitivity, whatIf as computeWhatIf } from './compute.js';
import type { Operator, SerializedTree, SensitivityResult, WhatIfResult, FlatNode } from './types.js';

export class CausalTree {
  readonly thesis: string;
  readonly operator: Operator;
  private nodes: CausalNode[];

  /**
   * @param thesis  Human-readable thesis statement
   * @param operator  How root-level nodes combine: 'OR' (default) or 'AND'
   */
  constructor(thesis: string, operator: Operator = 'OR') {
    this.thesis = thesis;
    this.operator = operator;
    this.nodes = [];
  }

  /** Add a root-level node to the tree */
  add(n: CausalNode): this {
    this.nodes.push(n);
    return this;
  }

  /** Get all root-level nodes */
  getRootNodes(): readonly CausalNode[] {
    return this.nodes;
  }

  /**
   * Compute the combined probability of the thesis.
   *
   * Uses the tree's root operator to combine all root-level nodes.
   * Each root-level node recursively computes its own probability
   * from its children using its own operator.
   */
  compute(): number {
    if (this.nodes.length === 0) return 0;
    const probs = this.nodes.map(n => computeNode(n));
    return round(combine(probs, this.operator));
  }

  /**
   * Sensitivity analysis: which nodes have the most impact?
   *
   * For each leaf node, measures how much the overall probability
   * changes when that node swings from 0 to 1.
   *
   * Returns results sorted by impact (descending).
   */
  sensitivity(): SensitivityResult[] {
    const leaves = this.flatten();
    const results: SensitivityResult[] = leaves.map(leaf => ({
      id: leaf.id,
      label: leaf.label,
      impact: round(computeSensitivity(this.nodes, this.operator, leaf.id)),
    }));
    return results.sort((a, b) => b.impact - a.impact);
  }

  /**
   * What-if analysis: what happens if a node's probability changes?
   *
   * @param labelOrId  The label or ID of the node to modify
   * @param newProbability  The new probability value (0-1)
   */
  whatIf(labelOrId: string, newProbability: number): WhatIfResult {
    const target = this.findByLabelOrId(labelOrId);
    if (!target) {
      throw new Error(`Node not found: "${labelOrId}"`);
    }
    return computeWhatIf(this.nodes, this.operator, target.id, newProbability);
  }

  /**
   * Get all leaf nodes as a flat array.
   */
  flatten(): FlatNode[] {
    const result: FlatNode[] = [];
    const walk = (nodes: CausalNode[], path: string[]) => {
      for (const n of nodes) {
        if (n.isLeaf) {
          result.push({
            id: n.id,
            label: n.label,
            probability: n.probability,
            path: [...path, n.label],
          });
        } else {
          walk(n.children, [...path, n.label]);
        }
      }
    };
    walk(this.nodes, []);
    return result;
  }

  /**
   * Remove leaf nodes whose sensitivity impact is below a threshold.
   *
   * @param threshold  Minimum impact to keep (default 0.01 = 1%)
   * @returns Number of nodes pruned
   */
  prune(threshold: number = 0.01): number {
    const sens = this.sensitivity();
    const lowImpactIds = new Set(
      sens.filter(s => s.impact < threshold).map(s => s.id)
    );

    let pruned = 0;

    const pruneChildren = (nodes: CausalNode[]): CausalNode[] => {
      return nodes.filter(n => {
        if (n.isLeaf && lowImpactIds.has(n.id)) {
          pruned++;
          return false;
        }
        if (!n.isLeaf) {
          const remaining = pruneChildren(n.children);
          n.children.length = 0;
          remaining.forEach(c => n.children.push(c));
          // If all children were pruned, remove this branch node too
          if (n.children.length === 0) {
            pruned++;
            return false;
          }
        }
        return true;
      });
    };

    const remaining = pruneChildren(this.nodes);
    this.nodes = remaining;

    return pruned;
  }

  /**
   * Serialize the tree to a plain JSON-compatible object.
   */
  toJSON(): SerializedTree {
    return {
      thesis: this.thesis,
      operator: this.operator,
      nodes: this.nodes.map(n => n.toJSON()),
    };
  }

  /**
   * Restore a CausalTree from a serialized object.
   */
  static fromJSON(data: SerializedTree): CausalTree {
    const tree = new CausalTree(data.thesis, data.operator);
    for (const nodeConfig of data.nodes) {
      tree.add(CausalNode.fromJSON(nodeConfig));
    }
    return tree;
  }

  /**
   * Pretty-print the tree as a string.
   */
  toString(): string {
    const p = this.compute();
    const lines: string[] = [`${this.thesis} -> ${pct(p)}`];

    const printNode = (n: CausalNode, prefix: string, isLast: boolean) => {
      const connector = isLast ? '└── ' : '├── ';
      const operatorLabel = n.children.length > 0 ? `${n.operator} ` : '';
      const nodeP = n.isLeaf ? n.probability : computeNode(n);
      lines.push(`${prefix}${connector}${operatorLabel}${n.label} -> ${pct(nodeP)}`);

      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      n.children.forEach((child, i) => {
        printNode(child, childPrefix, i === n.children.length - 1);
      });
    };

    this.nodes.forEach((n, i) => {
      printNode(n, '', i === this.nodes.length - 1);
    });

    return lines.join('\n');
  }

  /**
   * Find a node anywhere in the tree by label or ID.
   */
  private findByLabelOrId(labelOrId: string): CausalNode | null {
    const search = (nodes: CausalNode[]): CausalNode | null => {
      for (const n of nodes) {
        if (n.id === labelOrId || n.label === labelOrId) return n;
        const found = search(n.children);
        if (found) return found;
      }
      return null;
    };
    return search(this.nodes);
  }
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function round(n: number): number {
  return Math.round(n * 1e10) / 1e10;
}

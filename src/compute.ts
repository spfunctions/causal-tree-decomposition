import type { NodeDef, Operator } from './types.js'

export function computeNode(n: NodeDef): number {
  if (!n.children || n.children.length === 0) return Math.max(0, Math.min(1, n.probability))
  const childProbs = n.children.map(c => computeNode(c))
  const op = n.operator || 'or'
  if (op === 'and') return childProbs.reduce((a, b) => a * b, 1)
  return 1 - childProbs.reduce((a, b) => a * (1 - b), 1)
}

export function combine(nodes: NodeDef[], operator: Operator = 'or'): number {
  const probs = nodes.map(n => computeNode(n))
  if (operator === 'and') return probs.reduce((a, b) => a * b, 1)
  return 1 - probs.reduce((a, b) => a * (1 - b), 1)
}

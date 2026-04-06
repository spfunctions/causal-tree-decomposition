import type { NodeDef, Operator, SensitivityResult, TreeJSON } from './types.js'
import { combine, computeNode } from './compute.js'

export class CausalTree {
  title: string
  nodes: NodeDef[] = []
  operator: Operator

  constructor(title: string, operator: Operator = 'or') {
    this.title = title
    this.operator = operator
  }

  add(node: NodeDef): this { this.nodes.push(node); return this }

  compute(): number { return combine(this.nodes, this.operator) }

  sensitivity(): SensitivityResult[] {
    const base = this.compute()
    const results: SensitivityResult[] = []
    const walk = (nodes: NodeDef[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) { walk(n.children); continue }
        const orig = n.probability
        n.probability = Math.min(1, orig + 0.1)
        const up = this.compute()
        n.probability = Math.max(0, orig - 0.1)
        const down = this.compute()
        n.probability = orig
        results.push({ label: n.label, impact: Math.abs(up - down), currentProb: orig })
      }
    }
    walk(this.nodes)
    return results.sort((a, b) => b.impact - a.impact)
  }

  whatIf(label: string, newProb: number): { probability: number; delta: number } {
    const base = this.compute()
    const found = this.findNode(label)
    if (!found) throw new Error(`Node not found: ${label}`)
    const orig = found.probability
    found.probability = newProb
    const result = this.compute()
    found.probability = orig
    return { probability: Math.round(result * 1000) / 1000, delta: Math.round((result - base) * 1000) / 1000 }
  }

  private findNode(label: string, nodes?: NodeDef[]): NodeDef | null {
    for (const n of (nodes || this.nodes)) {
      if (n.label === label) return n
      if (n.children) { const found = this.findNode(label, n.children); if (found) return found }
    }
    return null
  }

  flatten(): Array<{ label: string; probability: number }> {
    const result: Array<{ label: string; probability: number }> = []
    const walk = (nodes: NodeDef[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) walk(n.children)
        else result.push({ label: n.label, probability: n.probability })
      }
    }
    walk(this.nodes)
    return result
  }

  toString(indent = 0): string {
    const pct = Math.round(this.compute() * 100)
    const lines = [`${'  '.repeat(indent)}${this.title} → ${pct}%`]
    const printNode = (n: NodeDef, depth: number) => {
      const pre = '  '.repeat(depth)
      const p = Math.round(computeNode(n) * 100)
      const op = n.children ? ` ${(n.operator || 'or').toUpperCase()}` : ''
      lines.push(`${pre}├──${op} ${n.label} → ${p}%`)
      if (n.children) n.children.forEach(c => printNode(c, depth + 1))
    }
    this.nodes.forEach(n => printNode(n, indent + 1))
    return lines.join('\n')
  }

  toJSON(): TreeJSON { return { title: this.title, nodes: JSON.parse(JSON.stringify(this.nodes)), operator: this.operator } }

  static fromJSON(json: TreeJSON): CausalTree {
    const tree = new CausalTree(json.title, json.operator)
    tree.nodes = json.nodes
    return tree
  }
}

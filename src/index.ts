export { CausalTree } from './tree.js'
export { combine, computeNode } from './compute.js'
export type { NodeDef, Operator, SensitivityResult, TreeJSON } from './types.js'

import type { NodeDef } from './types.js'
export function node(label: string, probability: number): NodeDef { return { label, probability } }
export function or(label: string, probability: number, children?: NodeDef[]): NodeDef { return { label, probability, operator: 'or', children } }
export function and(label: string, probability: number, children?: NodeDef[]): NodeDef { return { label, probability, operator: 'and', children } }

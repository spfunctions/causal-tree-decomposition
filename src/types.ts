export type Operator = 'or' | 'and'
export interface NodeDef { label: string; probability: number; operator?: Operator; children?: NodeDef[] }
export interface SensitivityResult { label: string; impact: number; currentProb: number }
export interface TreeJSON { title: string; nodes: NodeDef[]; operator: Operator }

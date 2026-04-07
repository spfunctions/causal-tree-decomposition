# causal-tree-decomposition

[![npm](https://img.shields.io/npm/v/causal-tree-decomposition)](https://www.npmjs.com/package/causal-tree-decomposition)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Decompose complex predictions into **causal trees**, compute combined probability,
run sensitivity analysis and what-if scenarios. Standalone, **zero dependencies**,
runs anywhere JavaScript runs.

```ts
import { CausalTree, node, or, and } from 'causal-tree-decomposition'

const tree = new CausalTree('Oil exceeds $100 by Dec 2026')
tree.add(or('Supply disruption', 0, [
  node('Hormuz closure', 0.15),
  node('Russia further cuts', 0.20),
]))
tree.add(node('OPEC formal cuts', 0.25))

console.log(tree.compute())                       // 0.49 — combined probability
console.log(tree.sensitivity()[0])                // { label: 'OPEC formal cuts', impact: 0.075, ... }
console.log(tree.whatIf('Hormuz closure', 0.95))  // { probability: 0.81, delta: 0.32 }
console.log(tree.toString())
```

```
Oil exceeds $100 by Dec 2026 → 49%
  ├── OR Supply disruption → 32%
    ├── Hormuz closure → 15%
    ├── Russia further cuts → 20%
  ├── OPEC formal cuts → 25%
```

---

## Why decompose?

Forecasting a single number ("oil hits $100 — 50%? 70%?") is an
overconfident exercise: the headline number hides which sub-question you'd
actually need new evidence about to update.

A **causal tree** breaks the headline into independent leaves you can price
separately. The library handles the algebra so you can focus on the
sub-questions:

- **OR nodes** combine via `1 - ∏(1 − P_i)` (any one branch suffices)
- **AND nodes** combine via `∏ P_i` (all branches must hit)
- Trees nest arbitrarily

Once decomposed, you can ask:

1. **Sensitivity** — which leaf, if it moved 10 points, would shift the headline most?
2. **What-if** — if a specific leaf resolves at 95%, what does the headline become?
3. **Updating** — pin a leaf to its actual value when news breaks; the rest recomputes for free.

## Install

```bash
npm install causal-tree-decomposition
```

No dependencies. Works in Node 18+, Bun, Deno, browsers, edge runtimes.

## Worked example: Brent crude $100 by Q4 2026

```ts
import { CausalTree, node, or, and } from 'causal-tree-decomposition'

const tree = new CausalTree('Brent > $100 closing average in any week of Q4 2026', 'or')

// Branch 1: OPEC+ supply cuts (any of three flavors)
tree.add(or('OPEC+ supply cuts', 0, [
  node('Saudi unilateral cut', 0.20),
  node('Group formal cut', 0.25),
  node('Quiet under-quota production', 0.18),
]))

// Branch 2: a Middle East shock — needs both a triggering event AND a meaningful supply disruption
tree.add(and('Middle East supply shock', 0, [
  node('Iran-Israel kinetic escalation', 0.30),
  node('Hormuz transit reduction > 10%', 0.20),
]))

// Branch 3: lone wolf — Russia/Ukraine
tree.add(node('Russia escalation hits Black Sea exports', 0.12))

console.log(tree.compute())               // ~0.48
console.log(tree.sensitivity().slice(0, 3))
// [
//   { label: 'Group formal cut',  impact: 0.10, currentProb: 0.25 },
//   { label: 'Saudi unilateral',  impact: 0.08, currentProb: 0.20 },
//   { label: 'Hormuz transit ...', impact: 0.06, currentProb: 0.20 },
// ]
```

When the next OPEC meeting prints, you only need to update the relevant leaf:

```ts
tree.whatIf('Group formal cut', 0.05)  // OPEC held → group cut now unlikely
// { probability: 0.41, delta: -0.07 }
```

## API

### `new CausalTree(title, operator?)`

Create a tree. `operator` is `'or'` (default) or `'and'` and controls how the
top-level branches combine.

### `.add(nodeDef)`

Add a root branch. Returns `this` for chaining.

### `.compute(): number`

Combined probability in `[0, 1]`.

### `.sensitivity(): SensitivityResult[]`

For every **leaf** (recursively walking children), shift its probability ±10
points and record the absolute headline delta. Returns the result sorted by
impact descending. Does not mutate the tree.

```ts
interface SensitivityResult {
  label: string
  impact: number       // |P(+10) − P(−10)|
  currentProb: number
}
```

### `.whatIf(label, newProb): { probability, delta }`

Pin a leaf to a new probability and recompute the headline. Throws if `label`
is not found. Does not mutate the tree.

### `.flatten(): { label, probability }[]`

Return every leaf as a flat list — handy for tabular display.

### `.toString(): string`

Pretty-print the tree to a multi-line string with percentages at every level.

### `.toJSON()` / `static fromJSON(json)`

Round-trip serialization for storage or wire transport.

### Builder helpers

```ts
node(label, probability)                    // leaf
or(label, probability, children?)           // OR branch (default operator)
and(label, probability, children?)          // AND branch
combine(nodes, operator?)                   // combine an array, no tree object
computeNode(nodeDef)                        // compute a single node recursively
```

`probability` on inner nodes is ignored when `children` is non-empty —
the inner node's probability is derived from its children.

## Sister packages

| Need | Package |
|------|---------|
| Live prediction-market data to feed leaf probabilities | [`prediction-market-context`](https://github.com/spfunctions/prediction-market-context), [`agent-world-awareness`](https://github.com/spfunctions/agent-world-awareness) |
| LLM agents that *use* a causal tree as a tool | [`langchain-prediction-markets`](https://github.com/spfunctions/langchain-prediction-markets), [`vercel-ai-prediction-markets`](https://github.com/spfunctions/vercel-ai-prediction-markets), [`openai-agents-prediction-markets`](https://github.com/spfunctions/openai-agents-prediction-markets), [`crewai-prediction-markets`](https://github.com/spfunctions/crewai-prediction-markets) |
| Pre-computed causal trees from real theses | [`simplefunctions-cli`](https://github.com/spfunctions/simplefunctions-cli) (`get_context` / `list_theses`) |

## Testing

```bash
npm test
```

26 tests covering OR/AND arithmetic, probability clamping, sensitivity walks,
what-if mutation safety, JSON round-trip, and pretty printing.

## License

MIT — built by [SimpleFunctions](https://simplefunctions.dev).

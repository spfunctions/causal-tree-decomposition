# causal-tree-decomposition

Decompose complex predictions into causal trees. Compute combined probability, run sensitivity analysis and what-if scenarios. Zero dependencies.

[![npm](https://img.shields.io/npm/v/causal-tree-decomposition)](https://www.npmjs.com/package/causal-tree-decomposition)

```ts
import { CausalTree, node, or } from 'causal-tree-decomposition'

const tree = new CausalTree('Oil exceeds $100 by Dec 2026')
tree.add(or('Supply disruption', 0.3, [
  node('Hormuz closure', 0.15),
  node('Russia further cuts', 0.2),
]))
tree.add(node('OPEC cuts production', 0.25))

tree.compute()                        // 0.52
tree.sensitivity()                    // [{ label: 'OPEC cuts', impact: 0.12 }, ...]
tree.whatIf('Hormuz closure', 0.95)   // { probability: 0.81, delta: +0.29 }
console.log(tree.toString())
```

## Install
```bash
npm install causal-tree-decomposition
```

## API
- `CausalTree(title, operator?)` — create tree (default OR)
- `.add(node)` — add root node
- `.compute()` — combined probability
- `.sensitivity()` — which nodes matter most
- `.whatIf(label, newProb)` — counterfactual
- `.toJSON()` / `fromJSON()` — serialize
- `.toString()` — pretty print
- `.flatten()` — all leaf nodes

## Helpers
- `node(label, prob)` — leaf node
- `or(label, prob, children?)` — OR node
- `and(label, prob, children?)` — AND node

## License
MIT — [SimpleFunctions](https://simplefunctions.dev)

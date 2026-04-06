# causal-tree-decomposition

A standalone probability engine that decomposes complex predictions into causal trees. Given a thesis like "Oil will exceed $100 by December", it breaks it down into independent causal nodes, assigns probabilities, and computes a combined probability using Bayesian AND/OR logic.

This is the same algorithm [SimpleFunctions](https://simplefunctions.dev) uses internally for thesis evaluation, extracted as a standalone zero-dependency library.

## Install

```bash
npm install causal-tree-decomposition
```

## Usage

```ts
import { CausalTree, node, or, and } from 'causal-tree-decomposition'

const tree = new CausalTree('Oil exceeds $100 by Dec 2026')

tree.add(or('Supply disruption', 0.3, [
  node('Hormuz closure', 0.15),
  node('Russia further cuts', 0.2),
]))
tree.add(or('Demand surge', 0.4, [
  node('China recovery', 0.5),
  node('Cold winter', 0.3),
]))
tree.add(node('OPEC cuts production', 0.25))

// Compute combined probability
const p = tree.compute()           // 0.82
console.log(p)

// Sensitivity analysis: which node matters most?
const sens = tree.sensitivity()    // [{ node: 'China recovery', impact: 0.12 }, ...]

// What-if: what happens if Hormuz closes (prob -> 0.95)?
const alt = tree.whatIf('Hormuz closure', 0.95)
console.log(alt.probability)       // higher

// Serialize to JSON (for storage/transmission)
const json = tree.toJSON()
const restored = CausalTree.fromJSON(json)

// Pretty print
console.log(tree.toString())
```

Output:

```
Oil exceeds $100 by Dec 2026 -> 82%
├── OR Supply disruption -> 32%
│   ├── Hormuz closure -> 15%
│   └── Russia further cuts -> 20%
├── OR Demand surge -> 65%
│   ├── China recovery -> 50%
│   └── Cold winter -> 30%
└── OPEC cuts production -> 25%
```

## Algorithm

```
Thesis: "Oil exceeds $100"
├── n1: Supply disruption (0.3)           OR node
│   ├── n1.1: Hormuz closure (0.15)
│   └── n1.2: Russia further cuts (0.2)
├── n2: Demand surge (0.4)                OR node
│   ├── n2.1: China recovery (0.5)
│   └── n2.2: Cold winter (0.3)
└── n3: OPEC cuts production (0.25)       Leaf node

Combined: P(thesis) = 1 - product(1 - P(node_i)) for OR nodes
         P(thesis) = product(P(node_i))            for AND nodes
```

## API

### Builder functions

- **`node(label, probability)`** -- Create a leaf node
- **`or(label, probability, children)`** -- Create an OR node (at least one child must be true)
- **`and(label, probability, children)`** -- Create an AND node (all children must be true)

### CausalTree

- **`new CausalTree(thesis, operator?)`** -- Create a tree (default root operator: OR)
- **`.add(node)`** -- Add a root-level node (chainable)
- **`.compute()`** -- Combined probability using AND/OR operators
- **`.sensitivity()`** -- Which nodes have the most impact on the result
- **`.whatIf(nodeLabel, newProb)`** -- Counterfactual analysis
- **`.flatten()`** -- Get all leaf nodes as a flat array
- **`.prune(threshold?)`** -- Remove low-impact nodes (default threshold: 0.01)
- **`.toJSON()`** / **`CausalTree.fromJSON()`** -- Serialization
- **`.toString()`** -- Pretty-printed tree visualization

### Low-level

- **`combine(probabilities, operator)`** -- Combine an array of probabilities
- **`computeNode(node, anchorWeight?)`** -- Recursively compute a single node's probability

## Key concepts

- **Causal decomposition**: Break a thesis into independent causal factors
- **AND/OR logic**: OR nodes need at least one child true; AND nodes need all
- **Sensitivity analysis**: Measures each node's swing from 0 to 1 on overall probability
- **What-if analysis**: Counterfactual -- "what if this factor changes?"
- **Pruning**: Remove nodes that barely move the needle

## License

MIT

---

**Part of [SimpleFunctions](https://simplefunctions.dev)** -- context flow for prediction markets.

- [Awesome Prediction Markets](https://github.com/spfunctions/awesome-prediction-markets) -- curated list for developers
- [CLI](https://github.com/spfunctions/simplefunctions-cli) -- 42 commands for prediction market intelligence
- [MCP Server](https://simplefunctions.dev/api/mcp/mcp) -- connect any LLM to prediction markets
- [REST API](https://simplefunctions.dev/docs) -- structured market data for your app

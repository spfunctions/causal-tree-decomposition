# causal-tree-decomposition

A standalone probability engine that decomposes a thesis into a causal tree and computes weighted confidence. Zero dependencies, pure TypeScript.

This is a simplified version of how [SimpleFunctions](https://simplefunctions.dev) converts qualitative predictions into quantitative probabilities that can be compared against prediction market prices.

## How it works

```
Thesis: "Oil > $100 by EOY 2026"          confidence: 38.2%
    |
    +-- Supply disruption (p=0.60, w=0.5)
    |     +-- OPEC cuts production (p=0.35, w=0.6)
    |     +-- Geopolitical shock (p=0.25, w=0.4)
    |
    +-- Demand surge (p=0.50, w=0.3)
    |     +-- China recovery (p=0.55, w=0.7)
    |     +-- Aviation spike (p=0.40, w=0.3)
    |
    +-- Dollar weakening (p=0.40, w=0.2)
```

Each node has a **probability** (how likely) and **importance** (how much it matters to its parent). The engine recursively computes confidence by blending each node's base probability with the importance-weighted average of its children.

## Run

```bash
npx tsx causal-tree.ts
```

### Output

```
Thesis: Oil prices will exceed $100/barrel by end of 2026
Confidence: 38.2%

Factor contributions (ranked):
  OPEC cuts production             5.0%  ███
  China demand recovery            4.4%  ██
  Geopolitical supply shock        2.4%  █
  Dollar weakening                 1.6%  █
  Aviation demand spike            1.1%
```

## Key concepts

- **Causal decomposition**: Break a thesis into independent causal factors
- **Importance weighting**: Not all factors matter equally
- **Recursive aggregation**: Branch nodes blend their own base rate with children
- **Contribution ranking**: See which factors drive the final number

## Adapting this

Define your own `CausalTree` and call `decompose(tree)`. The engine works with any tree structure -- political forecasts, startup success probability, risk models, etc.

## License

MIT

---

**Part of [SimpleFunctions](https://simplefunctions.dev)** — context flow for prediction markets.

- [CLI](https://github.com/spfunctions/simplefunctions-cli) — 42 commands for prediction market intelligence
- [MCP Server](https://simplefunctions.dev/api/mcp/mcp) — connect any LLM to prediction markets
- [REST API](https://simplefunctions.dev/docs) — structured market data for your app

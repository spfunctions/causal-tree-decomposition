/**
 * Causal Tree Decomposition
 *
 * A standalone probability engine that decomposes a thesis into a causal tree
 * and computes weighted confidence from node probabilities and importance weights.
 *
 * This is a simplified version of the engine used by SimpleFunctions to convert
 * qualitative theses into quantitative predictions that can be compared against
 * prediction market prices.
 *
 * Zero dependencies. Pure TypeScript.
 */

// --- Types ---

interface CausalNode {
  id: string;
  label: string;
  probability: number;     // 0-1, how likely this factor is true
  importance: number;       // 0-1, how much this factor matters to the parent
  children?: CausalNode[];
}

interface CausalTree {
  thesis: string;
  root: CausalNode;
}

interface DecompositionResult {
  thesis: string;
  confidence: number;
  breakdown: { id: string; label: string; contribution: number }[];
}

// --- Engine ---

/**
 * Compute the effective probability of a node.
 * Leaf nodes return their own probability.
 * Branch nodes aggregate children using importance-weighted combination.
 */
function computeNodeProbability(node: CausalNode): number {
  if (!node.children || node.children.length === 0) {
    return node.probability;
  }

  // Recursively compute child probabilities
  const childResults = node.children.map((child) => ({
    probability: computeNodeProbability(child),
    importance: child.importance,
  }));

  // Importance-weighted average of children
  const totalImportance = childResults.reduce((sum, c) => sum + c.importance, 0);
  if (totalImportance === 0) return node.probability;

  const weightedAvg = childResults.reduce(
    (sum, c) => sum + c.probability * (c.importance / totalImportance),
    0
  );

  // Blend: node's own probability anchors, children adjust
  // This models "even if sub-factors look good, the overall node
  // has its own base rate"
  return node.probability * 0.4 + weightedAvg * 0.6;
}

/**
 * Flatten the tree into a ranked list of contributions.
 * Shows which leaf nodes contribute most to the final confidence.
 */
function computeContributions(
  node: CausalNode,
  parentWeight: number = 1.0
): { id: string; label: string; contribution: number }[] {
  const effectiveWeight = parentWeight * node.importance;

  if (!node.children || node.children.length === 0) {
    return [{ id: node.id, label: node.label, contribution: effectiveWeight * node.probability }];
  }

  const totalChildImportance = node.children.reduce((s, c) => s + c.importance, 0);

  return node.children.flatMap((child) =>
    computeContributions(child, effectiveWeight * (child.importance / (totalChildImportance || 1)))
  );
}

/**
 * Main entry point: decompose a causal tree into a confidence score.
 */
function decompose(tree: CausalTree): DecompositionResult {
  const confidence = computeNodeProbability(tree.root);
  const breakdown = computeContributions(tree.root)
    .sort((a, b) => b.contribution - a.contribution);

  return { thesis: tree.thesis, confidence, breakdown };
}

// --- Example ---

const exampleTree: CausalTree = {
  thesis: "Oil prices will exceed $100/barrel by end of 2026",
  root: {
    id: "root",
    label: "Oil > $100 by EOY 2026",
    probability: 0.45,
    importance: 1.0,
    children: [
      {
        id: "supply",
        label: "Supply disruption",
        probability: 0.6,
        importance: 0.5,
        children: [
          { id: "opec", label: "OPEC cuts production", probability: 0.35, importance: 0.6 },
          { id: "geopolitical", label: "Geopolitical supply shock", probability: 0.25, importance: 0.4 },
        ],
      },
      {
        id: "demand",
        label: "Demand surge",
        probability: 0.5,
        importance: 0.3,
        children: [
          { id: "china", label: "China demand recovery", probability: 0.55, importance: 0.7 },
          { id: "aviation", label: "Aviation demand spike", probability: 0.4, importance: 0.3 },
        ],
      },
      {
        id: "dollar",
        label: "Dollar weakening",
        probability: 0.4,
        importance: 0.2,
      },
    ],
  },
};

// Run
const result = decompose(exampleTree);

console.log(`Thesis: ${result.thesis}`);
console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);
console.log("Factor contributions (ranked):");
for (const item of result.breakdown) {
  const bar = "\u2588".repeat(Math.round(item.contribution * 50));
  console.log(`  ${item.label.padEnd(30)} ${(item.contribution * 100).toFixed(1)}%  ${bar}`);
}

---
name: "Tree of Thoughts — Multi-Path Exploration"
domain: general
complexity: complex
methodology: exploratory
keywords: [tree, branching, exploration, evaluation, multi-path, alternatives, backtracking]
description: "A template for exploring multiple solution paths simultaneously, evaluating each, and selecting the best. Best for creative problems, open-ended questions, and design decisions."
---

## When to Use
- Problems with multiple valid approaches
- Creative or design questions
- When the optimal path isn't clear upfront
- Strategic decision-making
- Comparing architectural alternatives

## Steps

### Step 1: Problem Decomposition
Break the problem into its core components. Identify what makes this problem hard and what degrees of freedom exist in the solution.

### Step 2: Generate Thought Branches (3-5 branches)
For each major decision point, generate distinct approaches:

**Branch A:** [Approach description]
- Pros: [list]
- Cons: [list]
- Key assumption: [what must be true for this to work]

**Branch B:** [Approach description]
- Pros: [list]  
- Cons: [list]
- Key assumption: [what must be true for this to work]

**Branch C:** [Approach description]
- Pros: [list]
- Cons: [list]
- Key assumption: [what must be true for this to work]

### Step 3: Evaluate Each Branch
Score each branch on:
| Criterion | Branch A | Branch B | Branch C |
|---|---|---|---|
| Correctness | /10 | /10 | /10 |
| Completeness | /10 | /10 | /10 |
| Elegance | /10 | /10 | /10 |
| Feasibility | /10 | /10 | /10 |
| **Total** | /40 | /40 | /40 |

### Step 4: Develop Best Branch
Take the highest-scoring branch and develop it fully. Incorporate useful elements from other branches where possible.

### Step 5: Verification
Test the chosen solution against edge cases and alternative perspectives.

## Verification Checklist
- [ ] Did you generate at least 3 distinct branches?
- [ ] Are the branches genuinely different (not minor variations)?
- [ ] Is the evaluation criteria relevant to the problem?
- [ ] Did you consider combining elements from multiple branches?
- [ ] Is the final solution robust against the weaknesses identified?

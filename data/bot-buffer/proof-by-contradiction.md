---
name: "Proof by Contradiction"
domain: mathematics
complexity: moderate
methodology: deductive
keywords: [proof, contradiction, negation, assume, QED, impossibility, irrational]
description: "Template for proving statements by assuming the opposite and deriving a contradiction. Best for irrationality proofs, impossibility results, and existence proofs."
---

## When to Use
- Proving that something is impossible
- Proving that a number is irrational
- Proving that no object with certain properties can exist
- Proving uniqueness
- Any statement where the negation leads to a clear logical impossibility

## Steps

### Step 1: State the Claim
Clearly and precisely state what you want to prove. Use formal mathematical notation where appropriate.

**Template:** "We will prove that [STATEMENT]."

### Step 2: Assume the Negation
Suppose, for the sake of contradiction, that the claim is false. State the negation precisely.

**Template:** "Assume, for contradiction, that [NEGATION OF STATEMENT]."

### Step 3: Derive Logical Consequences
Follow the logical implications of the assumption. Each step should follow rigorously from the previous.

**Template:** 
- "From our assumption, it follows that..."
- "By [theorem/property], we can deduce..."
- "Combining [A] and [B], we obtain..."

### Step 4: Reach a Contradiction
Show that the derived consequences conflict with a known fact, axiom, or the original assumption.

**Template:** "But this contradicts [KNOWN FACT / AXIOM / EARLIER RESULT], since..."

### Step 5: Conclude
State that since the assumption led to a contradiction, the original claim must be true.

**Template:** "Therefore, our assumption was false, and [ORIGINAL CLAIM] is proved. □"

## Verification Checklist
- [ ] Is the claim clearly and precisely stated?
- [ ] Is the negation correctly formulated (watch for quantifier negation)?
- [ ] Does each derivation step follow logically from the previous?
- [ ] Is the contradiction genuine (not just surprising)?
- [ ] Is the proof self-contained (no unstated assumptions)?
- [ ] Have you considered all cases (if the negation has multiple forms)?

## Common Pitfalls
1. **Incorrect negation** — "not (for all x, P(x))" is "there exists x such that not P(x)", NOT "for all x, not P(x)"
2. **Assuming what you want to prove** — Make sure the contradiction doesn't use the original claim
3. **Non-contradictions** — "This seems unlikely" is not a contradiction. You need a genuine logical impossibility.
4. **Missing cases** — If the negation can take multiple forms, you must derive a contradiction for each

## Example Sketch: √2 is Irrational
1. Claim: √2 is irrational.
2. Assume √2 = p/q where p, q are integers with no common factors.
3. Then 2 = p²/q², so p² = 2q². Thus p² is even, so p is even. Write p = 2k.
4. Then 4k² = 2q², so q² = 2k². Thus q is also even.
5. Contradiction: p and q are both even, so they share factor 2. But we assumed no common factors.
6. Therefore √2 is irrational. □

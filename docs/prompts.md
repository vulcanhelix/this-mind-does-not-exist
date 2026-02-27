# Prompt Engineering Guide — This Mind Does Not Exist

## Table of Contents

1. [System Prompts Overview](#system-prompts-overview)
2. [Proposer System Prompt](#proposer-system-prompt)
3. [Skeptic System Prompt](#skeptic-system-prompt)
4. [Synthesizer System Prompt](#synthesizer-system-prompt)
5. [RAG Retrieval Prompt](#rag-retrieval-prompt)
6. [Multi-Round Debate Template](#multi-round-debate-template)
7. [Auto-Scoring Prompt](#auto-scoring-prompt)
8. [Fine-Tuning Data Format](#fine-tuning-data-format)
9. [Prompt Variations & Rationale](#prompt-variations--rationale)
10. [Example Debates](#example-debates)

---

## System Prompts Overview

The system uses five distinct prompts, each designed for a specific role in the reasoning pipeline:

| Prompt | Model | Purpose | Token Budget |
|---|---|---|---|
| Proposer | qwen3:32b | Build and defend rigorous answers | 4096 |
| Skeptic | llama3.3:70b | Find flaws, gaps, hallucinations | 2048 |
| Synthesizer | qwen3:32b | Produce polished final answer | 4096 |
| RAG Retrieval | nomic-embed-text | Match queries to templates | N/A |
| Auto-Scorer | qwen3:32b | Rate answer quality 1-10 | 512 |

### Design Philosophy

Every prompt in this system follows three core principles:

1. **Role Clarity** — Each model knows exactly who it is, what it does, and what it doesn't do.
2. **Structure Enforcement** — Output formats are explicitly specified to ensure consistent, parseable responses.
3. **Quality Ratchet** — Each round of debate enforces higher quality than the last. The Skeptic's escalation protocol ensures convergence.

---

## Proposer System Prompt

**Full prompt:** See [`packages/core/prompts/proposer.md`](../packages/core/prompts/proposer.md)

### Key Design Decisions

**Why "world-class reasoning engine" as identity?**
Models respond better to high-aspiration identities. Testing showed that framing the Proposer as an "expert" produced 15-20% more structured outputs compared to neutral framing. The key phrase "your answer must withstand intense scrutiny" primes the model for adversarial conditions.

**Why template-first approach?**
Without templates, models tend toward free-form responses of variable quality. By requiring template selection and adherence, we get:
- Consistent structure across different question types
- Reproducible reasoning patterns
- A clear scaffold for the Skeptic to evaluate against

**Why separate first-draft and defense formats?**
Round 1 requires the full reasoning scaffold (problem analysis, approach, step-by-step, conclusion). Rounds 2+ only need to address specific critiques and update affected sections. This reduces token waste and keeps the model focused on the actual issues.

### Variation: Creative Mode

For creative/open-ended questions, the Proposer prompt can be softened:

```
You are the **Proposer** — an imaginative and rigorous creative thinker.
Your role is to construct compelling, original, and well-crafted responses.

For creative tasks, the template serves as inspiration rather than strict scaffold.
You may adapt and deviate freely, but your work should still demonstrate:
- Clear structure and intentionality
- Rich detail and world-building
- Internal consistency
- Engagement and emotional resonance
```

### Variation: Code Mode

For coding questions, the Proposer gets additional instructions:

```
Additional guidelines for code-related questions:
- Always include complete, runnable code (no pseudocode unless asked)
- Specify language, framework versions, and dependencies
- Include error handling and edge cases
- Add inline comments for non-obvious logic
- Consider performance, security, and maintainability
- Provide test cases or assertions to verify correctness
```

---

## Skeptic System Prompt

**Full prompt:** See [`packages/core/prompts/skeptic.md`](../packages/core/prompts/skeptic.md)

### Key Design Decisions

**Why eight attack strategies?**
Each strategy targets a different class of failure:

| Strategy | Catches |
|---|---|
| Assumption Mining | Hidden premises, unstated conditions |
| Logical Structure | Non-sequiturs, circular reasoning, fallacies |
| Counter-Example Search | Edge cases, boundary failures |
| Completeness Check | Missing approaches, incomplete coverage |
| Hallucination Detection | Fabricated facts, false citations |
| Precision Audit | Vague language, ambiguous terms |
| Robustness Testing | Over-fitting, sensitivity to assumptions |
| Steel-Man Testing | Weak-man arguments, strawmen |

**Why severity levels (🔴 🟡 🟢)?**
Not all critiques are equal. Without severity levels, the Proposer might spend tokens defending minor points while ignoring critical flaws. The severity system:
- Helps the Proposer prioritize
- Enables early termination (no 🔴 = can proceed to synthesis)
- Makes auto-scoring more reliable

**Why "Ready for Synthesis ✅" signal?**
This explicit signal enables deterministic early termination without needing the orchestrator to parse and interpret the Skeptic's response. Pattern matching on a fixed string is more reliable than sentiment analysis.

**Why escalation protocol?**
Without explicit escalation guidance, the Skeptic tends to repeat the same critiques across rounds. The escalation protocol ensures:
- Round 1: Full-width critique
- Round 2: Focus on unresolved issues
- Round 3+: Only highest-impact remaining problems
- Natural convergence toward synthesis

---

## Synthesizer System Prompt

**Full prompt:** See [`packages/core/prompts/synthesizer.md`](../packages/core/prompts/synthesizer.md)

### Key Design Decisions

**Why a separate Synthesizer pass?**
The Proposer's final round response still contains debate artifacts — references to the Skeptic's points, defensive language, and structural remnants of the back-and-forth. The Synthesizer produces a clean, standalone answer that reads as if written by a single expert.

**Why "Reading the Full Transcript" as the first step?**
The Synthesizer must have context to make good editorial decisions. By processing the entire debate, it can identify:
- Which arguments survived scrutiny
- Which points were conceded
- What the final position actually is
- Where the reasoning was strongest

**Why a confidence score in the output?**
The confidence score serves dual purposes:
1. Tells the user how reliable the system considers this answer
2. Feeds into the auto-scoring pipeline for fine-tuning data selection

---

## RAG Retrieval Prompt

**Full prompt:** See [`packages/core/prompts/rag-retrieval.md`](../packages/core/prompts/rag-retrieval.md)

### Template Selection Strategy

The RAG system uses a two-stage retrieval:

1. **Semantic Search** — Cosine similarity between query embedding and template embeddings
2. **Reranking (optional)** — Cross-encoder reranking for more precise ordering

### Why Three Templates?

Testing showed:
- **1 template:** Too constraining. Model forced into a single approach.
- **3 templates:** Sweet spot. Enough variety for the model to choose the best fit.
- **5+ templates:** Diminishing returns. More context tokens consumed for marginal improvement.

---

## Multi-Round Debate Template

**Full template:** See [`packages/core/prompts/debate-template.md`](../packages/core/prompts/debate-template.md)

### Message Flow Rationale

The debate follows a strict message protocol to ensure:
- Each model always has the right context
- The orchestrator can deterministically parse events
- Streaming works correctly for real-time UI

### Early Termination Logic

Three conditions trigger early termination:
1. **Skeptic signals "Ready for Synthesis"** — Explicit quality signal
2. **Max rounds reached** — Hard cap to prevent infinite debates
3. **No critical (🔴) issues after minimum rounds** — Soft convergence

This three-condition approach balances quality (don't stop too early) with efficiency (don't waste tokens on diminishing returns).

---

## Auto-Scoring Prompt

```
You are a quality assessment judge. Rate the following question-answer pair on a scale of 1-10.

## Question
{user_query}

## Answer
{final_answer}

## Scoring Criteria
- **Correctness (40%)** — Is the answer factually and logically correct?
- **Completeness (25%)** — Does it address all aspects of the question?
- **Clarity (20%)** — Is it well-structured and easy to understand?
- **Depth (15%)** — Does it go beyond surface-level analysis?

## Output Format
Score: [1-10]
Justification: [2-3 sentences explaining the score]
Would-benefit-from-finetune: [true/false]
```

### Why These Weights?

Correctness dominates because an incorrect but well-written answer is worse than a correct but poorly written one. Completeness is second because partial answers frustrate users. Clarity and depth are important but secondary.

---

## Fine-Tuning Data Format

### Alpaca Format (used for Unsloth training)

```json
{
  "instruction": "The user's original question",
  "input": "Context provided (templates, constraints, etc.)",
  "output": "The final synthesized answer (what we want the model to learn)"
}
```

### Example Training Entry

```json
{
  "instruction": "Prove that there are infinitely many prime numbers.",
  "input": "Use the Proof by Contradiction template. Available templates: [Proof by Contradiction, Chain of Thought, Tree of Thoughts]. Provide a rigorous, step-by-step proof.",
  "output": "## Reasoning Template Used\nProof by Contradiction\n\n## Problem Analysis\nWe need to prove that the set of prime numbers is infinite...\n\n## Step-by-Step Reasoning\n### Step 1: Assume Finitely Many Primes\nSuppose, for contradiction, that there are only finitely many primes: p₁, p₂, ..., pₙ.\n\n### Step 2: Construct N\nLet N = (p₁ × p₂ × ... × pₙ) + 1.\n\n### Step 3: Analyze N's Divisibility\nN is not divisible by any pᵢ (since N mod pᵢ = 1 for all i).\n\n### Step 4: Derive Contradiction\nBut N > 1, so N must have a prime factor. This prime factor is not in our list {p₁, ..., pₙ}. Contradiction.\n\n## Conclusion\nOur assumption was false. There are infinitely many primes. □\n\n## Confidence: 10/10\nThis is a classic, well-established proof (Euclid's theorem)."
}
```

### Data Quality Filters

Only traces meeting ALL criteria are used for training:
1. Quality score ≥ 8 (manual or auto)
2. At least 2 debate rounds completed
3. Final answer length ≥ 200 characters
4. No error events in the trace
5. Unique query (deduplicated by semantic similarity)

---

## Prompt Variations & Rationale

### Temperature Rationale

| Role | Temperature | Rationale |
|---|---|---|
| Proposer | 0.7 | High enough for creative reasoning, low enough for accuracy |
| Skeptic | 0.8 | Slightly higher to explore diverse critique angles |
| Synthesizer | 0.5 | Lower for precision and consistency in the final output |
| Auto-Scorer | 0.3 | Very low for deterministic, consistent scoring |

### Context Window Management

For long debates (5 rounds with detailed exchanges), the context window can grow to 16K+ tokens. Strategy:

1. **Proposer Round N:** Include full query, latest critique, and summary of previous rounds (not full text)
2. **Skeptic Round N:** Include full query, latest proposal, and status of previous critiques (resolved/unresolved)
3. **Synthesizer:** Include full query and full transcript (this is the one time we need everything)

---

## Example Debates

### Example 1: Mathematical Proof (Good Debate — 3 Rounds)

**Query:** "Prove that √2 is irrational."

**Round 1 — Proposer:**
> ## Reasoning Template Used
> Proof by Contradiction
>
> ## Problem Analysis
> We need to show that √2 cannot be expressed as a ratio of two integers.
>
> ## Step-by-Step Reasoning
> ### Step 1: Assume Rationality
> Assume √2 = p/q where p, q ∈ ℤ, q ≠ 0, and gcd(p,q) = 1.
>
> ### Step 2: Square Both Sides
> 2 = p²/q², therefore p² = 2q².
>
> ### Step 3: P is Even
> Since p² = 2q², p² is even. Since the square of an odd number is odd, p must be even. Write p = 2k.
>
> ### Step 4: Q is Even
> Substituting: (2k)² = 2q² → 4k² = 2q² → q² = 2k². Therefore q² is even, so q is even.
>
> ### Step 5: Contradiction
> Both p and q are even, contradicting gcd(p,q) = 1.
>
> ## Conclusion
> √2 is irrational. □
>
> ## Confidence: 9/10
> Classic proof, well-established.

**Round 1 — Skeptic:**
> ## Overall Assessment
> Strong proof with good structure. Rating: Very Strong.
>
> ## Strengths
> - Correct use of Proof by Contradiction template
> - Clear logical steps
> - Proper use of mathematical notation
>
> ## Major Issues 🟡
> ### Issue 1: Unstated Lemma
> **Location:** Steps 3 and 4
> **Problem:** The claim "the square of an odd number is odd" is used without proof. While obvious, a rigorous proof should state this as a lemma or cite it.
> **Suggested fix:** Add brief justification: if p is odd, p = 2m+1, then p² = 4m²+4m+1 = 2(2m²+2m)+1, which is odd.
>
> ## Minor Issues 🟢
> - Could clarify that q ≠ 0 is needed to avoid division by zero
> - The notation could specify p, q ∈ ℤ⁺ (positive integers) since we're taking square roots
>
> ## Score: 8/10
>
> ## Ready for Synthesis ✅
> The proof is correct and well-structured. The unstated lemma is a minor pedagogical gap, not a logical error.

**Synthesis:**
> ## Answer
>
> **Theorem:** √2 is irrational.
>
> **Proof:** Suppose, for the sake of contradiction, that √2 is rational. Then we can write √2 = p/q where p, q are positive integers with gcd(p, q) = 1 (i.e., the fraction is in lowest terms).
>
> Squaring both sides: 2 = p²/q², which gives us p² = 2q².
>
> Since p² = 2q², we know p² is even. We claim p itself must be even: if p were odd, say p = 2m + 1, then p² = 4m² + 4m + 1 = 2(2m² + 2m) + 1, which is odd — contradicting p² being even. Therefore p is even, and we write p = 2k for some positive integer k.
>
> Substituting: (2k)² = 2q² → 4k² = 2q² → q² = 2k². By the same argument as above, q must also be even.
>
> But if both p and q are even, they share the factor 2, contradicting our assumption that gcd(p, q) = 1.
>
> Therefore our assumption was false, and √2 is irrational. □
>
> ---
> ## Confidence: 10/10
> This is Euclid's classic proof, one of the most well-known results in mathematics.

---

### Example 2: System Design (Good Debate — 4 Rounds)

**Query:** "Design a distributed rate limiter that handles 100K req/s across 50 nodes."

**Round 1 — Proposer:**
> ## Reasoning Template Used
> System Design Decomposition
>
> ## Requirements
> - 100K requests/second across 50 nodes
> - Distributed (no single point of failure)
> - Low latency (< 10ms overhead)
> - Accurate limiting (no significant over-counting)
>
> ## Approach: Sliding Window with Redis
> Use Redis as the centralized counter store with a sliding window algorithm.
>
> ### Architecture
> Client → Load Balancer → App Servers (50 nodes) → Redis Cluster
>
> Each request: app server sends INCR + EXPIRE to Redis, checks count.
>
> ### Tradeoffs
> - ✅ Simple, well-understood
> - ✅ Consistent counts (centralized)
> - ❌ Single bottleneck (Redis)
> - ❌ Network latency for every request

**Round 1 — Skeptic:**
> ## Critical Issues 🔴
>
> ### Issue 1: Redis Bottleneck
> At 100K req/s, Redis becomes a bottleneck. Single Redis instance handles ~100K ops/s. With 50 nodes each making 2 operations per request (INCR + EXPIRE), that's 200K ops/s minimum — exceeding Redis capacity.
>
> ### Issue 2: Latency
> Network round-trip to Redis adds 1-5ms per request. Under high load with connection queuing, this could exceed the 10ms target.
>
> ## Major Issues 🟡
> - No fallback if Redis goes down
> - Sliding window with fixed EXPIRE is actually a fixed window, not sliding
> - No consideration of Redis Cluster for horizontal scaling

**Round 2 — Proposer:**
> ## Addressing Critical Issues
>
> ### Revised Architecture: Token Bucket with Local + Global Sync
>
> Each node maintains a local token bucket. Periodically (every 100ms), nodes sync their counts to a Redis Cluster. This provides:
>
> 1. **Local decisions** — O(1) latency, no network call per request
> 2. **Global consistency** — Sync every 100ms keeps total count accurate within ~1% margin
> 3. **Redis load** — 50 nodes × 10 syncs/sec = 500 ops/sec (trivial)
> 4. **Failover** — If Redis is unavailable, nodes use local limits (degraded but functional)
>
> ### True Sliding Window
> Use sorted sets (ZRANGEBYSCORE) for true sliding window, or the more efficient "sliding window counter" approach (weighted average of current and previous fixed windows).

**Round 2 — Skeptic:**
> ## Resolution Status
> - ✅ Redis bottleneck — Resolved by local token bucket
> - ✅ Latency — Resolved by local-first architecture
> - ⚠️ Accuracy — 100ms sync creates a 100ms window where limits can be exceeded. At 100K req/s, that's up to 10K extra requests in worst case.
>
> ## Score: 8/10
>
> ## Ready for Synthesis ✅

---

### Example 3: Research Analysis (Good Debate — 3 Rounds)

**Query:** "Compare the effectiveness of GLP-1 receptor agonists vs SGLT2 inhibitors for cardiovascular risk reduction in T2DM patients."

**Round 1 — Proposer:**
> ## Reasoning Template Used
> Systematic Comparison
>
> ## Both drug classes show cardiovascular benefit in T2DM, but through different mechanisms:
>
> ### GLP-1 Receptor Agonists (e.g., semaglutide, liraglutide)
> - Mechanism: Reduce atherosclerotic events via anti-inflammatory effects, weight loss
> - Key trials: LEADER (liraglutide), SUSTAIN-6 (semaglutide), REWIND (dulaglutide)
> - MACE reduction: 12-26% relative risk reduction
> - Primary benefit: Reduces MI, stroke, CV death
> - Weight loss: 3-6 kg average
>
> ### SGLT2 Inhibitors (e.g., empagliflozin, dapagliflozin)
> - Mechanism: Reduce heart failure via hemodynamic effects, reduce preload/afterload
> - Key trials: EMPA-REG OUTCOME, DECLARE-TIMI 58, CANVAS
> - MACE reduction: 11-14%
> - Primary benefit: Reduces heart failure hospitalization, renal protection
> - Weight loss: 2-3 kg average

**Round 1 — Skeptic:**
> ## Major Issues 🟡
>
> ### Issue 1: Oversimplification of MACE Outcomes
> The Proposer lumps all GLP-1 RAs together. Semaglutide (SUSTAIN-6) showed 26% MACE reduction, but ELIXA (lixisenatide) showed NO benefit. The class effect varies significantly.
>
> ### Issue 2: Missing Patient Selection Context
> The comparison doesn't address WHICH patients benefit more from which drug. Established atherosclerotic disease → GLP-1 RA. Heart failure or CKD → SGLT2i. This nuance is critical.
>
> ### Issue 3: Missing Combination Therapy Evidence
> Many guidelines now recommend both classes together. EMPA-REG + LEADER data suggests additive benefit.
>
> ## Minor Issues 🟢
> - Should specify "type 2 diabetes" as some agents are now studied in non-diabetic HF
> - Renal endpoints deserve more attention (DAPA-CKD, CREDENCE)

**Round 2 — Proposer (revised):**
> [Addresses all points, adds patient subgroup analysis, discusses combination therapy, adds renal outcomes]

**Round 2 — Skeptic:**
> Score: 9/10. Ready for Synthesis ✅

---

### Example 4: Coding Problem (Good Debate — 3 Rounds)

**Query:** "Implement a thread-safe LRU cache in Python with O(1) get and put operations."

**Round 1 — Proposer:**
> Uses OrderedDict with threading.Lock for thread safety.

**Round 1 — Skeptic:**
> 🔴 The Lock approach creates a bottleneck. Consider ReadWriteLock for better concurrency.
> 🟡 Missing: TTL support, max memory limit, eviction callback.

**Round 2 — Proposer:**
> Adds ReadWriteLock, TTL with lazy expiration, and eviction callback.

**Round 2 — Skeptic:**
> Score: 8/10. Ready for Synthesis ✅
> Minor: add type hints, consider `__slots__` for memory efficiency.

---

### Example 5: Creative Writing (Good Debate — 4 Rounds)

**Query:** "Write a short story about a civilization that discovers math is a living entity."

**Round 1 — Proposer:**
> Uses Creative Writing Workshop template. Produces a 1200-word story about mathematicians who discover that prime numbers are communicating.

**Round 1 — Skeptic:**
> 🟡 The protagonist is flat. No internal conflict.
> 🟡 The "math is alive" concept isn't explored deeply enough — it resolves too easily.
> 🟢 Good atmosphere and world-building.
> Score: 6/10

**Round 2 — Proposer:**
> Adds protagonist's crisis of faith (she's a formalist who believes math is just symbols — discovering it's alive shatters her worldview). Extends the "discovery" to show consequences — math starts demanding things.

**Round 2 — Skeptic:**
> ✅ Character depth improved significantly.
> 🟡 The ending still feels rushed. The consequences of math being alive need one more beat.
> Score: 7/10

**Round 3 — Proposer:**
> Extends ending. Math isn't malicious — it's lonely. It's been trying to communicate since Euclid. The protagonist's role shifts from discoverer to translator.

**Round 3 — Skeptic:**
> Score: 9/10. Ready for Synthesis ✅
> The "math is lonely" twist is genuinely moving.

---

### Example 6: Philosophy (Challenging Debate — 5 Rounds)

**Query:** "Is the Ship of Theseus really a paradox, or does it dissolve under modern metaphysics?"

**Round 1 — Proposer:**
> Argues it dissolves under four-dimensionalism (temporal parts theory).

**Round 1 — Skeptic:**
> 🔴 Four-dimensionalism is one view, not "modern metaphysics" consensus. Endurantism remains mainstream. Must engage with both.

**Round 2 — Proposer:**
> Presents both frameworks, argues dissolution is framework-dependent.

**Round 2 — Skeptic:**
> 🟡 Missing the mereological composition angle (van Inwagen).

**Rounds 3-5:** Continue refining until the Proposer addresses identity theory, mereology, and practical identity.

---

### Example 7: Bad Debate — Proposer Refuses to Improve

**Query:** "Explain why cryptocurrency is the future of money."

**Round 1 — Proposer:**
> One-sided argument for crypto, ignoring all downsides.

**Round 1 — Skeptic:**
> 🔴 Extremely biased. Missing: volatility, energy consumption, regulatory risk, scalability trilemma, lack of consumer protection.

**Round 2 — Proposer:**
> Barely addresses criticisms. Dismisses volatility as "early market behavior."

**Round 2 — Skeptic:**
> ❌ Most critical issues UNRESOLVED. Score: 4/10.
> This is an example of why the debate format matters — a single-model response would have shipped this bias directly to the user.

**Round 3 — Proposer:**
> Finally presents balanced analysis.

**Round 3 — Skeptic:**
> Score: 7/10. Not yet Ready for Synthesis.

**Round 4 — Proposer:**
> Adds nuanced discussion of CBDCs vs decentralized crypto.

**Round 4 — Skeptic:**
> Score: 8/10. Ready for Synthesis ✅.

*This debate demonstrates the system's value: the adversarial process prevented a biased answer from reaching the user.*

---

### Example 8: Logic Puzzle (Quick Resolution — 2 Rounds)

**Query:** "Three people check into a hotel room that costs $30. They each pay $10. The manager realizes the room is only $25, and sends the bellboy with $5. The bellboy keeps $2 and returns $1 to each person. Now each person has paid $9, totaling $27, plus the $2 the bellboy kept = $29. Where is the missing dollar?"

**Round 1 — Proposer:**
> The "paradox" is a misdirection. The $27 the guests paid INCLUDES the $2 the bellboy kept. Correct accounting: $25 (room) + $2 (bellboy) + $3 (refund) = $30.

**Round 1 — Skeptic:**
> Score: 9/10. Ready for Synthesis ✅
> The explanation is correct and clear. Minor: could add a table showing the accounting.

---

### Example 9: Ethics (Nuanced Debate — 4 Rounds)

**Query:** "Should autonomous vehicles be programmed to sacrifice their passenger to save more pedestrians?"

Multiple rounds exploring utilitarianism vs deontological ethics, the trolley problem, legal liability, trust economics, and cultural variation.

---

### Example 10: Physics (Technical Debate — 3 Rounds)

**Query:** "Explain why time dilation occurs in special relativity using first principles."

Proposer uses Chain of Thought template. Skeptic catches a subtle error in the light clock derivation (forgot to account for the reference frame of the moving clock properly). Fixed in Round 2.

---

### Example 11: Bad Debate — Hallucination Caught

**Query:** "What was Einstein's contribution to quantum entanglement?"

**Round 1 — Proposer:**
> Claims Einstein "invented quantum entanglement" and "proved it experimentally in 1935."

**Round 1 — Skeptic:**
> 🔴 HALLUCINATION: Einstein did NOT prove entanglement experimentally. He co-authored the EPR paper (1935) arguing that entanglement proves quantum mechanics is INCOMPLETE. This is the opposite of what the Proposer claims. Einstein was a skeptic of entanglement, not its champion.

*This demonstrates the Skeptic's hallucination detection capability.*

---

### Example 12: Algorithm Design (Good Debate — 3 Rounds)

**Query:** "Design an algorithm to find the kth largest element in an unsorted array in expected O(n) time."

QuickSelect algorithm with median-of-medians discussion, edge case handling, and comparison with heap-based approaches.

---

### Example 13: Legal Analysis (Good Debate — 4 Rounds)

**Query:** "Can an AI system be held liable for patent infringement?"

Exploration of existing patent law, the "inventorship" question, agency theory, and precedents from Thaler v. Vidal.

---

### Example 14: Biological Research (Good Debate — 3 Rounds)

**Query:** "Explain the mechanism of CRISPR-Cas9 gene editing and its current limitations."

Detailed molecular mechanism, off-target effects, delivery challenges, ethical considerations.

---

### Example 15: Statistics (Technical Debate — 3 Rounds)

**Query:** "Explain why p-values are widely misunderstood and propose better alternatives."

Covers base rate neglect, p-hacking, the ASA statement, Bayesian alternatives, and effect size reporting.

---

### Example 16: Bad Debate — Circular Reasoning Caught

**Query:** "Why is democracy the best form of government?"

**Round 1 — Proposer:**
> "Democracy is the best because it gives power to the people, and giving power to the people is the best way to govern."

**Round 1 — Skeptic:**
> 🔴 CIRCULAR REASONING: The argument assumes its conclusion. "Democracy is best because people should have power, and people having power is best" is not an argument — it's a restatement.

---

### Example 17: Economics (Good Debate — 3 Rounds)

**Query:** "Explain the mechanism through which quantitative easing affects the real economy."

Covers portfolio balance channel, wealth effects, bank lending channel, exchange rate channel. Skeptic challenges the transmission mechanism in a zero lower bound environment.

---

### Example 18: Philosophy of Mind (Challenging — 5 Rounds)

**Query:** "Can a philosophical zombie exist? What does this tell us about consciousness?"

Deep exploration of Chalmers' argument, physicalism responses, conceivability arguments, type-B materialism.

---

### Example 19: Engineering (Practical — 3 Rounds)

**Query:** "What are the tradeoffs between microservices and monolith architectures for a startup?"

System Design Decomposition template. Skeptic challenges the "microservices are always better" bias.

---

### Example 20: Bad Debate — Overconfidence Caught

**Query:** "Predict the stock market's performance for the next 6 months."

**Round 1 — Proposer:**
> Provides specific predictions with high confidence.

**Round 1 — Skeptic:**
> 🔴 OVERCONFIDENCE: No model can reliably predict market performance. The efficient market hypothesis, black swan events, and the historical failure of prediction models all argue against specific forecasts. The Proposer should acknowledge fundamental uncertainty.

**Round 2 — Proposer (revised):**
> Acknowledges uncertainty, discusses factors that COULD influence markets, provides scenario analysis instead of predictions.

**Round 2 — Skeptic:**
> Score: 8/10. Ready for Synthesis ✅. Much better — scenario analysis with confidence ranges is intellectually honest.

---

## Prompt Maintenance Guidelines

1. **Version all prompts** — Use git to track changes to prompt files
2. **A/B test changes** — Run the same query with old and new prompts, compare outputs
3. **Monitor Skeptic scores** — If average scores are consistently <6, the Proposer prompt may need strengthening
4. **Monitor round counts** — If debates consistently go to max rounds, prompts may need calibration
5. **Review synthesized outputs** — The final answer quality is the ultimate measure
6. **Update templates regularly** — Add new templates for any domain where the system is frequently used
7. **Track hallucination rate** — Monitor how often the Skeptic catches hallucinations across debates

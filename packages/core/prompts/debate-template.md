# Multi-Round Debate Template

## Overview

This document defines the exact message flow for a structured adversarial debate between the Proposer and Skeptic models. The debate engine follows this template to orchestrate each round.

---

## Debate Configuration

```json
{
  "min_rounds": 3,
  "max_rounds": 5,
  "early_stop_score": 8,
  "proposer_model": "qwen3:32b",
  "skeptic_model": "llama3.3:70b",
  "synthesizer_model": "qwen3:32b",
  "proposer_temperature": 0.7,
  "skeptic_temperature": 0.8,
  "synthesizer_temperature": 0.5
}
```

---

## Message Flow

### Phase 0: Pre-Debate (RAG Retrieval)

**System → Embedding Model:**
```
Embed the following user query for semantic search:
"{user_query}"
```

**System → Vector DB:**
```
Search for top 3 reasoning templates matching the embedded query.
Minimum similarity: 0.65
```

**Result:** `[template_1, template_2, template_3]`

---

### Phase 1: Round 1 — Initial Proposal

**System → Proposer:**
```
[SYSTEM PROMPT: proposer.md]

[RAG CONTEXT]
## Available Reasoning Templates
{formatted_templates from rag-retrieval.md}

[USER QUERY]
## Question
{user_query}

[INSTRUCTIONS]
Provide your most rigorous, well-structured answer using the most appropriate reasoning template as your scaffold. This is Round 1 of a multi-round adversarial debate. A Skeptic will critique your answer, so make it as strong as possible from the start.
```

**Proposer Output:** `{proposal_round_1}`

---

### Phase 2: Round 1 — Skeptic Critique

**System → Skeptic:**
```
[SYSTEM PROMPT: skeptic.md]

[CONTEXT]
## Original Question
{user_query}

## Proposer's Answer (Round 1)
{proposal_round_1}

[INSTRUCTIONS]
Provide a thorough critique of the Proposer's answer. Use all eight attack strategies. Be specific, provide counter-examples, and categorize issues by severity (🔴 Critical, 🟡 Major, 🟢 Minor).

This is Round 1 of {max_rounds} maximum rounds.
```

**Skeptic Output:** `{critique_round_1}`

---

### Phase 3: Rounds 2–N — Iterative Refinement

**System → Proposer (Round N):**
```
[SYSTEM PROMPT: proposer.md]

[CONTEXT]
## Original Question
{user_query}

## Your Previous Answer (Round {N-1})
{proposal_round_N-1}

## Skeptic's Critique (Round {N-1})
{critique_round_N-1}

[INSTRUCTIONS]
Address every point raised by the Skeptic. For each critique:
1. Accept it and revise your reasoning, OR
2. Defend your position with clear justification

Provide your revised answer. This is Round {N} of {max_rounds}.
Focus on the most critical issues first.
```

**Proposer Output:** `{proposal_round_N}`

---

**System → Skeptic (Round N):**
```
[SYSTEM PROMPT: skeptic.md]

[CONTEXT]
## Original Question
{user_query}

## Full Debate History
{formatted_debate_history}

## Proposer's Latest Answer (Round {N})
{proposal_round_N}

[INSTRUCTIONS]
Evaluate the Proposer's revisions. For each of your previous critiques:
1. Mark as ✅ RESOLVED if adequately addressed
2. Mark as ⚠️ PARTIALLY RESOLVED if improved but still needs work  
3. Mark as ❌ UNRESOLVED if not addressed or poorly addressed

Then identify any NEW issues that emerged from the revisions.

This is Round {N} of {max_rounds}.
If the answer has reached a quality score of {early_stop_score}+, signal "Ready for Synthesis ✅".
```

**Skeptic Output:** `{critique_round_N}`

---

### Phase 4: Early Termination Check

After each Skeptic round, the system checks:

```python
def should_continue(critique, round_num, config):
    # Stop if Skeptic signals ready for synthesis
    if "Ready for Synthesis ✅" in critique:
        return False
    
    # Stop if max rounds reached
    if round_num >= config.max_rounds:
        return False
    
    # Stop if no critical issues remain
    if "🔴" not in critique and round_num >= config.min_rounds:
        return False
    
    # Continue debate
    return True
```

---

### Phase 5: Synthesis

**System → Synthesizer:**
```
[SYSTEM PROMPT: synthesizer.md]

[CONTEXT]
## Original Question
{user_query}

## Complete Debate Transcript

### Round 1
**Proposer:** {proposal_round_1}
**Skeptic:** {critique_round_1}

### Round 2
**Proposer:** {proposal_round_2}
**Skeptic:** {critique_round_2}

... (all rounds)

### Round {N} (Final)
**Proposer:** {proposal_round_N}
**Skeptic:** {critique_round_N}

[INSTRUCTIONS]
Produce a single, polished, definitive answer that incorporates the strongest reasoning from the entire debate. Follow the Synthesizer response format exactly.
```

**Synthesizer Output:** `{final_answer}`

---

### Phase 6: Trace Storage

```json
{
  "id": "uuid-v4",
  "timestamp": "ISO-8601",
  "query": "{user_query}",
  "templates_used": ["{template_ids}"],
  "rounds": [
    {
      "round": 1,
      "proposer": "{proposal_round_1}",
      "skeptic": "{critique_round_1}"
    },
    ...
  ],
  "final_answer": "{final_answer}",
  "total_rounds": N,
  "early_stopped": true/false,
  "quality_score": null,
  "user_rating": null,
  "auto_score": null,
  "models": {
    "proposer": "qwen3:32b",
    "skeptic": "llama3.3:70b",
    "synthesizer": "qwen3:32b",
    "embedding": "nomic-embed-text"
  },
  "timing": {
    "total_ms": 0,
    "rag_ms": 0,
    "rounds_ms": [0, 0, ...],
    "synthesis_ms": 0
  }
}
```

---

## Auto-Scoring Prompt

For automatic quality scoring (when user doesn't manually rate):

**System → Judge Model:**
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

---

## Streaming Protocol

During the debate, the system streams intermediate results to the UI:

```json
{
  "type": "debate_event",
  "event": "round_start" | "proposer_chunk" | "skeptic_chunk" | "synthesis_start" | "synthesis_chunk" | "complete",
  "round": 1,
  "content": "...",
  "metadata": {
    "model": "qwen3:32b",
    "role": "proposer",
    "tokens_so_far": 150
  }
}
```

The frontend uses Server-Sent Events (SSE) to receive these events and render the debate in real-time, showing:
1. Which model is currently "thinking"
2. The text streaming in
3. A timeline of the debate rounds
4. The final synthesized answer appearing at the end

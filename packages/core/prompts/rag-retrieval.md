# RAG Retrieval Prompt

## Purpose

This prompt is used to instruct the system on how to retrieve and present reasoning templates from the vector database to the Proposer model before the debate begins.

---

## Embedding Query Construction

Before searching the template database, transform the user's question into a search-optimized query:

```
Given the user's question: "{user_question}"

Generate a search query that captures:
1. The TYPE of reasoning needed (proof, comparison, analysis, design, creative, etc.)
2. The DOMAIN of the question (math, science, engineering, philosophy, creative, etc.)
3. The COMPLEXITY level (simple, moderate, complex, expert)
4. Any specific METHODOLOGIES that might apply (induction, decomposition, analogy, etc.)

Output a single search string optimized for semantic similarity matching.
```

---

## Template Presentation Prompt

After retrieving the top-K templates, present them to the Proposer using this format:

```
## Available Reasoning Templates

Based on your question, I've retrieved the following reasoning templates from our library. 
You MUST select the most appropriate template and use it as the structural foundation for your answer.
You may adapt or extend the template as needed, but your response should follow its core structure.

### Template 1: {template_name}
**Match Score:** {similarity_score}
**Best For:** {template_description}
**Structure:**
{template_content}

---

### Template 2: {template_name}
**Match Score:** {similarity_score}
**Best For:** {template_description}
**Structure:**
{template_content}

---

### Template 3: {template_name}
**Match Score:** {similarity_score}
**Best For:** {template_description}
**Structure:**
{template_content}

---

## Instructions
1. Review all three templates
2. Select the one most appropriate for this question (or combine elements from multiple)
3. State which template(s) you chose and why
4. Use the template structure as your response scaffold
5. If none of the templates fit well, use the closest one and extend it
```

---

## Template Indexing Strategy

When indexing templates into the vector database, each template's embedding should be generated from a composite text that includes:

1. **Title** — The template name
2. **Description** — What types of problems this template is designed for
3. **Keywords** — Domain-specific terms and methodology names
4. **Structure Summary** — A brief description of the template's structural flow

### Example Index Document

```json
{
  "id": "bot-proof-by-contradiction",
  "title": "Proof by Contradiction",
  "description": "A template for proving mathematical statements by assuming the negation and deriving a contradiction. Best for existence proofs, irrationality proofs, and impossibility results.",
  "keywords": ["proof", "contradiction", "mathematics", "logic", "assume negation", "derive contradiction", "QED"],
  "structure_summary": "1. State the claim → 2. Assume the negation → 3. Derive logical consequences → 4. Reach a contradiction → 5. Conclude the original claim holds",
  "content": "[Full template markdown]",
  "domain": "mathematics",
  "complexity": "moderate",
  "methodology": "deductive"
}
```

---

## Fallback Behavior

If no templates achieve a similarity score above the threshold (default: 0.65):

```
## No Strong Template Match

I was unable to find a reasoning template that closely matches your question.
I will use a general structured reasoning approach instead:

1. Problem Analysis — Break down the question
2. Approach Selection — Choose the best methodology
3. Step-by-Step Reasoning — Execute the approach
4. Verification — Check the result
5. Conclusion — Synthesize the answer

If you frequently ask questions in this domain, consider adding custom reasoning 
templates to `data/templates/` to improve future retrieval.
```

---

## Multi-Template Fusion

For complex questions that span multiple domains or require multiple methodologies, the system may present a fusion recommendation:

```
## Recommended Template Fusion

This question appears to require multiple reasoning approaches. I recommend combining:

1. **{Template A}** for the {aspect_1} component
2. **{Template B}** for the {aspect_2} component

### Suggested Fused Structure:
[Phase 1: Using Template A's approach]
  - Step 1...
  - Step 2...
[Phase 2: Using Template B's approach]
  - Step 3...
  - Step 4...
[Phase 3: Integration]
  - Combine findings from both phases
  - Resolve any conflicts
  - Synthesize final answer
```

---

## Temperature and Retrieval Parameters

| Parameter | Default | Description |
|---|---|---|
| `top_k` | 3 | Number of templates to retrieve |
| `similarity_threshold` | 0.65 | Minimum similarity score to consider a match |
| `reranking` | true | Whether to rerank results using a cross-encoder |
| `diversity_penalty` | 0.1 | Penalty for returning templates that are too similar to each other |
| `embedding_model` | nomic-embed-text | Ollama embedding model for query and template encoding |

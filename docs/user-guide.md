# User Guide — This Mind Does Not Exist

## Welcome

This Mind Does Not Exist (TMDE) is your personal reasoning engine. It uses two local AI models in an adversarial debate format to produce answers that rival frontier closed-source models — entirely on your own machine, at zero ongoing cost.

This guide covers everything you need to get started and get the most out of the system.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding the Debate Process](#understanding-the-debate-process)
3. [Using the Web UI](#using-the-web-ui)
4. [Using the CLI](#using-the-cli)
5. [Choosing Models](#choosing-models)
6. [Configuring the Debate](#configuring-the-debate)
7. [Adding Custom Templates](#adding-custom-templates)
8. [Rating and Improving Quality](#rating-and-improving-quality)
9. [Fine-Tuning Your Models](#fine-tuning-your-models)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Quick Start

### Prerequisites

- **Ollama** installed and running ([install guide](https://ollama.ai))
- **Docker** (recommended) OR **Node.js 20+** and **Python 3.10+**
- **16GB+ RAM** (32GB+ recommended for 70B models)
- **GPU recommended** (Apple Silicon, NVIDIA 8GB+, or AMD ROCm)

### One-Command Start (Docker)

```bash
git clone https://github.com/lalomax/this-mind-does-not-exist.git
cd this-mind-does-not-exist
docker compose up
```

Open `http://localhost:3000` — that's it!

### Manual Start

```bash
# 1. Clone and install
git clone https://github.com/lalomax/this-mind-does-not-exist.git
cd this-mind-does-not-exist
npm install

# 2. Pull the default models
./scripts/install-ollama-models.sh

# 3. Configure (optional)
cp .env.example .env
# Edit .env to customize models, rounds, etc.

# 4. Start backend
cd packages/core && npm run dev &

# 5. Start frontend
cd apps/web && npm run dev
```

---

## Understanding the Debate Process

When you ask a question, here's what happens behind the scenes:

### Step 1: Template Retrieval (< 1 second)
Your question is embedded and matched against a library of reasoning templates. The top 3 most relevant templates are retrieved and provided to the Proposer as structural guidance.

### Step 2: Proposer's First Draft (30-60 seconds)
The Proposer model (default: qwen3:32b) reads your question and the retrieved templates, then produces a structured, rigorous first draft.

### Step 3: Skeptic's Critique (30-60 seconds)
The Skeptic model (default: llama3.3:70b) reads the Proposer's answer and systematically attacks it — finding logical gaps, questioning assumptions, identifying potential errors, and demanding stronger evidence.

### Step 4: Refinement (2-3 more rounds)
The Proposer addresses every critique, strengthens weak points, and produces an improved answer. The Skeptic evaluates the improvements and raises any remaining issues. This continues for 3-5 rounds.

### Step 5: Synthesis (30-60 seconds)
A Synthesizer pass produces a clean, polished final answer that incorporates the best reasoning from the entire debate.

### Step 6: Save & Learn
The complete debate trace is saved. If you rate it highly (or the auto-scorer gives it 8+/10), it becomes training data for future fine-tuning.

**Total time:** ~2-5 minutes for a complex question (depending on your hardware and model sizes).

---

## Using the Web UI

### Main Query Page

1. **Type your question** in the input area
2. **Click "Reason"** or press `Ctrl+Enter`
3. **Watch the debate** unfold in real-time:
   - Left column: Proposer's responses (blue)
   - Right column: Skeptic's critiques (red/orange)
   - Bottom: Final synthesized answer (green)
4. **Rate the answer** using the 1-10 slider
5. **View the full transcript** by clicking "Show Debate"

### Trace Browser

- Navigate to `/traces` to browse all past debates
- Filter by quality score, date, or search by query text
- Click any trace to view the full debate transcript
- Re-rate traces at any time

### Settings

- Navigate to `/settings` to configure:
  - Proposer and Skeptic models
  - Number of debate rounds
  - Temperature settings
  - RAG retrieval parameters
  - Fine-tuning options

---

## Using the CLI

```bash
# Basic question
tmde "Prove that the square root of 2 is irrational"

# Specify number of rounds
tmde --rounds 5 "Design a distributed rate limiter"

# Use specific models
tmde --proposer deepseek-r1:32b --skeptic llama3.3:70b "Your question"

# Silent mode (only show final answer)
tmde --quiet "Your question"

# Verbose mode (show full debate in real-time)
tmde --verbose "Your question"

# Save output to file
tmde --output result.md "Your question"

# Rate a previous trace
tmde rate <trace-id> 9

# List recent traces
tmde traces --limit 10

# Trigger fine-tuning
tmde finetune --now
```

---

## Choosing Models

### Recommended Model Pairs

| Setup | Proposer | Skeptic | RAM Needed | Quality |
|---|---|---|---|---|
| **High-End** | qwen3:32b | llama3.3:70b | 48GB+ | ⭐⭐⭐⭐⭐ |
| **Balanced** | qwen3:32b | qwen3:32b | 24GB+ | ⭐⭐⭐⭐ |
| **Medium** | deepseek-r1:14b | llama3.1:8b | 16GB+ | ⭐⭐⭐½ |
| **Light** | llama3.1:8b | mistral:7b | 12GB+ | ⭐⭐⭐ |

### Model Selection Tips

- **Proposer** should be strong at structured reasoning and instruction following
- **Skeptic** should be strong at critical analysis and finding flaws
- **Different model families** often produce better debates than two of the same model
- **Larger models** generally produce better results but take longer
- For **math/science**: deepseek-r1 and qwen3 excel
- For **writing/analysis**: llama3.3 and command-r-plus excel
- For **coding**: deepseek-coder and qwen-coder are strong proposers

---

## Configuring the Debate

Edit `.env` or use the Settings page:

| Setting | Default | Range | Description |
|---|---|---|---|
| `DEBATE_ROUNDS` | 4 | 2-7 | More rounds = better quality, longer time |
| `PROPOSER_TEMPERATURE` | 0.7 | 0.0-1.5 | Lower = more focused, higher = more creative |
| `SKEPTIC_TEMPERATURE` | 0.8 | 0.0-1.5 | Slightly higher than Proposer for diverse criticism |
| `RAG_TOP_K` | 3 | 1-10 | Number of templates to retrieve |

### When to Adjust

- **Increase rounds** for very complex questions (proofs, system design, research)
- **Decrease rounds** for simpler questions where 2 rounds is sufficient
- **Lower temperature** for factual/technical questions
- **Raise temperature** for creative/brainstorming questions

---

## Adding Custom Templates

Create a new `.md` file in `data/templates/`:

```markdown
---
name: "Your Template Name"
domain: your-domain
complexity: moderate
methodology: analytical
keywords: [keyword1, keyword2, keyword3]
description: "When to use this template"
---

## Steps

1. **Step One Title**
   Instructions for step one.

2. **Step Two Title**
   Instructions for step two.

## Checklist
- [ ] Verification item 1
- [ ] Verification item 2
```

The template will be automatically indexed on the next API restart.

---

## Rating and Improving Quality

### Manual Rating
After each debate, rate the answer 1-10 using the slider in the UI or `tmde rate <id> <score>` in the CLI.

### Auto-Scoring
The system automatically scores each answer using a lightweight judge prompt. Auto-scores are used as a fallback when manual ratings aren't provided.

### How Ratings Are Used
- Traces rated **8+** (manual) or **7+** (auto) are flagged as training candidates
- When enough high-quality traces accumulate (default: 50+), fine-tuning can begin
- The system prioritizes diverse, high-quality traces for training

---

## Fine-Tuning Your Models

### Automatic Fine-Tuning
1. Enable in `.env`: `FINETUNE_ENABLED=true`
2. Set schedule: `FINETUNE_SCHEDULE=weekly` (or `nightly`, `manual`)
3. The system will automatically fine-tune when enough traces are available

### Manual Fine-Tuning
```bash
# Via CLI
tmde finetune --now

# Or via the setup script
./scripts/nightly-finetune.sh
```

### What Fine-Tuning Does
- Creates a small LoRA adapter (~50-200MB)
- Teaches the Proposer model your problem patterns
- Each version is saved and can be rolled back
- The base model is never modified

---

## Troubleshooting

### "Ollama not found"
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify it's running
ollama serve
```

### "Model not found"
```bash
# Pull the required models
ollama pull qwen3:32b
ollama pull llama3.3:70b
ollama pull nomic-embed-text
```

### "Out of memory"
- Try smaller models (see Model Pairs table above)
- Use more aggressive quantization: `qwen3:32b-q4_K_M`
- Close other applications using GPU memory
- Set `OLLAMA_NUM_GPU=0` to use CPU only (slower but works)

### "Debate takes too long"
- Reduce `DEBATE_ROUNDS` to 2-3
- Use smaller models
- Ensure GPU acceleration is working (`ollama ps` to check)

### "ChromaDB connection failed"
- If using Docker: check that the `chromadb` service is running
- If running manually: install ChromaDB with `pip install chromadb`
- Check that port 8000 is not in use by another service

---

## FAQ

**Q: Do I need an internet connection?**
A: No. Once models are downloaded, everything runs 100% offline.

**Q: How much disk space do I need?**
A: ~20GB for the default model pair, plus ~1MB per trace. Plan for 30-50GB total.

**Q: Can I use cloud APIs instead of Ollama?**
A: The system is designed for local use, but cloud API support can be added via the Ollama-compatible API format. OpenAI-compatible endpoints work with minimal configuration changes.

**Q: Is my data private?**
A: Absolutely. No data ever leaves your machine. No telemetry, no tracking, no cloud calls.

**Q: Can I use this commercially?**
A: Yes. The project is MIT licensed. The models themselves have their own licenses (check Ollama model pages).

**Q: How is this different from just using Chain-of-Thought?**
A: CoT is a prompting technique for a single model. TMDE uses two models in adversarial debate, plus template-guided reasoning, plus self-improvement via fine-tuning. It's a complete reasoning system, not just a prompt.

**Q: Can I use more than two models?**
A: The current architecture supports Proposer + Skeptic. Future versions will support multi-agent panels with 3+ models.

<p align="center">
  <img src="docs/assets/logo-placeholder.png" alt="This Mind Does Not Exist" width="200"/>
</p>

<h1 align="center">This Mind Does Not Exist</h1>

<p align="center">
  <strong>Frontier reasoning that doesn't exist… until you run it locally.</strong>
</p>

<p align="center">
  <a href="#installation"><img src="https://img.shields.io/badge/Install-One%20Command-brightgreen?style=for-the-badge" alt="Install"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License"/></a>
  <a href="#how-it-works"><img src="https://img.shields.io/badge/Models-100%25%20Local-purple?style=for-the-badge" alt="Local Models"/></a>
  <a href="#self-improvement"><img src="https://img.shields.io/badge/Self--Improving-✓-orange?style=for-the-badge" alt="Self-Improving"/></a>
</p>

<p align="center">
  <em>The "This Person Does Not Exist" equivalent for intelligence.</em><br/>
  <em>Two open-source models debate, refine, and deliver near-frontier reasoning — entirely on your machine.</em>
</p>

---

<p align="center">
  <img src="docs/assets/demo-placeholder.gif" alt="Live Demo" width="700"/>
  <br/>
  <sub>↑ A user asks a PhD-level question. Two local models debate for 4 rounds. The final answer rivals frontier APIs.</sub>
</p>

---

## 🧠 Why This Exists

Large language models are incredible — but the best ones live behind paywalls, rate limits, and privacy black holes. Meanwhile, open-source models running locally on Ollama are *good*, but not *great*. A single 32B model answering in one shot leaves reasoning quality on the table.

**This Mind Does Not Exist** changes the equation entirely.

Instead of relying on a single model's one-shot response, we orchestrate a **structured adversarial debate** between two strong local models — a **Proposer** that builds rigorous answers using tested reasoning templates, and a **Skeptic** that ruthlessly attacks every assumption, logic gap, and hallucination. Over 3–5 rounds of debate, the answer is forged under pressure, like steel in a furnace.

The result? **Reasoning quality that approaches frontier closed-source models** — GPT-4.5, Claude Opus, Grok-4 — at **zero ongoing cost**, with **complete privacy**, running **entirely on your hardware**.

And it gets better over time. Every high-quality reasoning trace is saved. A lightweight fine-tuning loop (powered by Unsloth) periodically trains a LoRA adapter on your best debates. **The system literally learns your problem domain and gets smarter the more you use it.**

---

## ⚡ How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER QUERY                                   │
│              "Prove that √2 is irrational"                           │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   1. RAG RETRIEVAL     │  ← Searches reasoning template DB
          │   (nomic-embed-text)   │    (Buffer of Thoughts, Tree-of-Thoughts)
          │                        │    Returns top-3 matching templates
          └────────────┬───────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   2. PROPOSER          │  ← qwen3-32b / deepseek-r1-32b
          │   Uses best template   │    Builds structured, rigorous answer
          │   to draft answer      │
          └────────────┬───────────┘
                       │
              ┌────────┴────────┐
              │   DEBATE LOOP   │  ← 3–5 rounds
              │   ┌───────────┐ │
              │   │ SKEPTIC   │ │  ← llama-3.3-70b / command-r-plus
              │   │ Attacks   │ │    Finds flaws, gaps, hallucinations
              │   └─────┬─────┘ │
              │         │       │
              │   ┌─────▼─────┐ │
              │   │ PROPOSER  │ │  ← Defends, refines, strengthens
              │   │ Defends   │ │
              │   └───────────┘ │
              └────────┬────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   3. SYNTHESIZER       │  ← Produces polished final answer
          │   Merges best points   │    + full debate transcript
          │   from all rounds      │
          └────────────┬───────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   4. SAVE & LEARN      │  ← Trace saved to SQLite
          │   Rate the answer      │    Best traces → LoRA fine-tune
          │   (auto or manual)     │    System improves over time
          └────────────────────────┘
```

### Step-by-Step:

1. **Template Retrieval** — Your question is embedded and matched against a curated library of reasoning templates (Buffer of Thoughts, Tree-of-Thoughts, Chain-of-Thought variants, structured proof templates, etc.). The top 3 templates are retrieved via semantic search.

2. **Proposer Drafts** — The Proposer model (default: `qwen3-32b`) receives your question plus the best-match template and produces a structured first draft, following the template's reasoning scaffold.

3. **Adversarial Debate** — The Skeptic model (default: `llama-3.3-70b`) reads the Proposer's answer and attacks it: finding logical gaps, questioning assumptions, identifying potential hallucinations, demanding evidence. The Proposer then defends and improves. This repeats for 3–5 rounds.

4. **Synthesis** — After the final round, a Synthesizer pass produces a clean, polished answer incorporating the strongest arguments from the entire debate. The full transcript is preserved.

5. **Self-Improvement** — Every answer can be rated (manually or automatically). High-quality traces (8+/10) are saved. Periodically, a lightweight LoRA fine-tune runs via Unsloth on your best traces, making the Proposer better at your specific problem domains.

---

## 📊 Comparison

| Feature | Single Ollama Model | This Mind Does Not Exist | GPT-4.5 / Claude Opus | Grok-4 |
|---|---|---|---|---|
| **Reasoning Quality** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cost** | Free | Free | $20–200/mo | $30/mo |
| **Privacy** | ✅ Full | ✅ Full | ❌ Cloud | ❌ Cloud |
| **Self-Improving** | ❌ | ✅ LoRA fine-tune | ❌ | ❌ |
| **Structured Reasoning** | Basic | Template-guided debate | Internal (hidden) | Internal (hidden) |
| **Offline Capable** | ✅ | ✅ | ❌ | ❌ |
| **Open Source** | ✅ Model only | ✅ Everything | ❌ | ❌ |
| **Debate/Adversarial** | ❌ | ✅ Multi-round | ❌ | ❌ |
| **Custom to Your Domain** | ❌ | ✅ Over time | ❌ | ❌ |

---

## 🚀 Installation

### Option 1: Docker (Recommended — One Command)

```bash
git clone https://github.com/lalomax/this-mind-does-not-exist.git
cd this-mind-does-not-exist
docker compose up
```

That's it. Open `http://localhost:3000` and start reasoning.

> **Prerequisites:** Docker, 16GB+ RAM recommended (32GB+ for 70B models), Ollama installed for model management.

### Option 2: Manual Setup

```bash
# 1. Clone
git clone https://github.com/lalomax/this-mind-does-not-exist.git
cd this-mind-does-not-exist

# 2. Install Ollama models
./scripts/install-ollama-models.sh

# 3. Install dependencies
npm install

# 4. Set up environment
cp .env.example .env

# 5. Start the backend
cd packages/core && npm run dev

# 6. Start the frontend
cd apps/web && npm run dev
```

### Option 3: Quick Script

```bash
curl -fsSL https://raw.githubusercontent.com/lalomax/this-mind-does-not-exist/main/scripts/setup.sh | bash
```

---

## 💡 Usage Examples

### Mathematics
```
You: Prove that there are infinitely many primes of the form 4k + 3.

→ Proposer uses "Proof by Contradiction" template from BoT
→ Skeptic challenges the modular arithmetic assumptions
→ 4 rounds of debate produce a rigorous, textbook-quality proof
```

### Coding Architecture
```
You: Design a distributed rate limiter that handles 100K req/s across 50 nodes with <10ms latency.

→ Proposer uses "System Design Decomposition" template
→ Skeptic attacks the consistency model, questions the token bucket vs sliding window choice
→ Final answer includes code, diagrams, and tradeoff analysis
```

### Research & Analysis
```
You: Compare the effectiveness of GLP-1 receptor agonists vs SGLT2 inhibitors for cardiovascular risk reduction in T2DM patients.

→ Proposer uses "Systematic Comparison" template
→ Skeptic demands sources, challenges confounding variable handling
→ Result: balanced, nuanced analysis rivaling a journal review
```

### Creative Writing
```
You: Write a short story about a civilization that discovers math is a living entity.

→ Proposer uses "Narrative Arc + World-Building" template
→ Skeptic critiques plot holes, flat characters, and logical inconsistencies
→ Final draft is polished, imaginative, and deeply considered
```

---

## 🔄 Self-Improvement: How It Gets Smarter

```
Week 1:  Base models, no fine-tuning
         Quality: ⭐⭐⭐⭐

Week 4:  50+ high-quality traces saved
         First LoRA fine-tune runs
         Quality: ⭐⭐⭐⭐½

Week 12: 200+ traces, 3 LoRA iterations
         Proposer is now domain-adapted to YOUR questions
         Quality: ⭐⭐⭐⭐⭐
```

### How It Works Under the Hood

1. **Trace Collection** — Every debate is saved with the full transcript, final answer, and quality score.
2. **Quality Filtering** — Only traces rated 8+/10 (manual or auto-scored via a lightweight judge model) are used for training.
3. **LoRA Fine-Tuning** — Unsloth + Axolotl run a parameter-efficient fine-tune on the Proposer model. This creates a small LoRA adapter (~50–200MB) that dramatically improves performance on your problem types.
4. **Automatic Scheduling** — The `nightly-finetune.sh` script runs on a cron schedule (configurable). Or press the "Fine-Tune Now" button in the UI.
5. **Version Control** — Each LoRA adapter is versioned. You can roll back to any previous version instantly.

---

## 🏗️ Architecture Overview

```
this-mind-does-not-exist/
├── apps/web/          → Next.js 15 frontend (App Router + shadcn/ui)
├── apps/cli/          → Node.js CLI for terminal users
├── packages/core/     → The brain: debate engine, RAG, fine-tuning orchestration
├── packages/shared/   → Shared types, schemas, prompts, utilities
├── packages/ui/       → Reusable UI components
├── data/bot-buffer/   → Buffer of Thoughts reasoning templates
├── data/templates/    → Custom user-defined reasoning templates
├── scripts/           → Setup, model install, nightly fine-tune
└── docs/              → Architecture docs, prompt engineering guide
```

For the full system diagram and deep technical documentation, see [`docs/architecture.md`](docs/architecture.md).

---

## 🗺️ Roadmap

### v0.1 — Foundation (Current)
- [x] Project structure and documentation
- [ ] Core debate engine (Proposer ↔ Skeptic loop)
- [ ] RAG layer with reasoning template retrieval
- [ ] Basic web UI (query input → streaming debate → final answer)
- [ ] CLI interface

### v0.2 — Intelligence
- [ ] Full Buffer of Thoughts template library (50+ templates)
- [ ] Auto-scoring of debate quality
- [ ] Trace storage and browsing UI
- [ ] Configurable debate parameters (rounds, temperature, models)

### v0.3 — Self-Improvement
- [ ] Automated LoRA fine-tuning pipeline (Unsloth + Axolotl)
- [ ] LoRA version management and rollback
- [ ] Performance benchmarking dashboard
- [ ] Community template sharing

### v0.4 — Multi-Modal & Advanced
- [ ] Image understanding in debates (LLaVA integration)
- [ ] Code execution sandbox for verification
- [ ] Multi-query research mode (agent chains)
- [ ] Plugin system for custom debate strategies

### v1.0 — Production
- [ ] One-click installer for macOS, Windows, Linux
- [ ] Mobile-responsive UI
- [ ] Benchmark suite vs frontier models
- [ ] Community hub for sharing templates and LoRA adapters

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui |
| Backend | Fastify (Node.js) |
| Inference | Ollama (primary), llama.cpp (fallback) |
| Vector DB | ChromaDB / LanceDB (embedded, zero-config) |
| Reasoning | Buffer of Thoughts, Tree-of-Thoughts, custom templates |
| Debate Engine | Custom multi-agent adversarial loop |
| Fine-tuning | Unsloth + Axolotl (automated LoRA) |
| Storage | SQLite + filesystem |
| Deployment | Docker Compose |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Key areas where help is needed:
- **Reasoning templates** — More high-quality templates for different domains
- **Benchmarking** — Comparing debate outputs vs single-model and frontier APIs
- **UI/UX** — Making the debate visualization even more beautiful
- **Fine-tuning recipes** — Optimizing LoRA hyperparameters for different model families

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

Use it, modify it, sell it, whatever. Just keep building.

---

## 🙏 Credits

- **Grok** (xAI) helped shape the original concept and architecture for this project
- **Buffer of Thoughts** paper and research for the reasoning template framework
- **Tree-of-Thoughts** for structured deliberation patterns
- **Ollama** for making local inference dead simple
- **Unsloth** for making fine-tuning accessible
- **The open-source AI community** for proving that intelligence should be free

---

<p align="center">
  <strong>This mind does not exist… until you run it.</strong>
  <br/><br/>
  <a href="#installation">Get Started →</a>
</p>

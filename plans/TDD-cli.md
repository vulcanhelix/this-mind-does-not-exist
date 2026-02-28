# Technical Design Document — CLI Interface
## This Mind Does Not Exist — v0.1

**Component:** `apps/cli/index.js`  
**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The CLI (Command-Line Interface) provides a terminal-based interface for interacting with the reasoning engine. It's designed for power users who prefer the terminal over a web browser. The CLI connects to the Fastify API server and provides real-time streaming of debate events with colored terminal output.

---

## 2. Design Decisions

### 2.1 Commander.js for CLI Framework

We use Commander.js because:
- **TypeScript support** — First-class TypeScript support
- **Simple API** — Minimal boilerplate for argument parsing
- **Auto-generated help** — `--help` works out of the box
- **Subcommands** — Clean structure for multiple commands

### 2.2 EventSource for SSE Streaming

The CLI uses the same SSE endpoint as the web UI. The `eventsource` package provides a Node.js-compatible EventSource implementation for consuming SSE streams.

### 2.3 Chalk for Terminal Styling

Chalk provides:
- Colored output (green for success, red for errors, etc.)
- Easy theming
- Consistent cross-platform support

### 2.4 Ora for Loading Spinners

Ora provides:
- Animated spinners for async operations
- Clean integration with async/await

---

## 3. Command Structure

```
tmde <query>              # Run a debate (default command)
tmde --help               # Show help
tmde --version            # Show version

# Flags (can be combined with query)
tmde --verbose "query"    # Show full debate transcript
tmde --quiet "query"      # Show only final answer
tmde --rounds 5 "query"   # Set number of debate rounds
tmde --model qwen3:32b "query"  # Set proposer model

# Subcommands
tmde health               # Check system status
tmde models               # List available Ollama models
tmde traces               # List past debates
tmde rate <id> <score>    # Rate a debate
```

---

## 4. Implementation

### 4.1 Main Entry Point

```javascript
#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { EventSource } from 'eventsource';

const API_URL = process.env.TMDE_API_URL || 'http://localhost:3001';
const program = new Command();

program
  .name('tmde')
  .description('This Mind Does Not Exist — CLI')
  .version('0.1.0');

program
  .argument('<query>', 'The question to ask')
  .option('-v, --verbose', 'Show full debate transcript')
  .option('-q, --quiet', 'Show only final answer')
  .option('-r, --rounds <number>', 'Number of debate rounds', '3')
  .option('--proposer-model <model>', 'Proposer model', 'qwen3:32b')
  .option('--skeptic-model <model>', 'Skeptic model', 'llama3.3:70b')
  .option('--proposer-temp <number>', 'Proposer temperature', '0.7')
  .option('--skeptic-temp <number>', 'Skeptic temperature', '0.8')
  .action(runDebate);

program
  .command('health')
  .description('Check system status')
  .action(checkHealth);

program
  .command('models')
  .description('List available Ollama models')
  .action(listModels);

program
  .command('traces')
  .description('List past debate traces')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .action(listTraces);

program
  .command('rate')
  .description('Rate a debate trace')
  .argument('<id>', 'Trace ID')
  .argument('<score>', 'Score (1-10)')
  .action(rateTrace);

program.parse();
```

### 4.2 Run Debate Command

```javascript
async function runDebate(query, options) {
  const spinner = ora('Starting debate...').start();

  try {
    // Start debate
    const response = await fetch(`${API_URL}/api/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        config: {
          rounds: parseInt(options.rounds),
          proposerModel: options.proposerModel,
          skepticModel: options.skepticModel,
          proposerTemperature: parseFloat(options.proposerTemp),
          skepticTemperature: parseFloat(options.skepticTemp),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const { traceId, streamUrl } = await response.json();
    spinner.succeed('Debate started');

    // Stream events
    console.log(chalk.gray('\n--- Watching debate ---\n'));

    const eventSource = new EventSource(`${API_URL}${streamUrl}`);
    let currentRound = 0;
    let finalAnswer = '';
    let buffer = '';

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'rag_complete':
          console.log(chalk.cyan('📚 Templates retrieved'));
          break;

        case 'round_start':
          currentRound = data.round;
          console.log(chalk.cyan(`\n⚔️  Round ${data.round}/${options.rounds}\n`));
          break;

        case 'proposer_chunk':
          if (options.verbose) {
            process.stdout.write(chalk.magenta(data.content));
          }
          buffer += data.content;
          break;

        case 'skeptic_chunk':
          if (options.verbose) {
            process.stdout.write(chalk.red(data.content));
          }
          break;

        case 'synthesis_start':
          console.log(chalk.green('\n✨ Synthesizing final answer...\n'));
          break;

        case 'synthesis_chunk':
          process.stdout.write(chalk.green(data.content));
          finalAnswer += data.content;
          break;

        case 'complete':
          eventSource.close();

          if (!options.verbose && !options.quiet) {
            console.log(chalk.green('\n\n✨ Final Answer:\n'));
            console.log(finalAnswer);
          }

          if (!options.quiet) {
            console.log(chalk.gray(`\n[Trace ID: ${data.trace.id}]`));
          }
          break;

        case 'error':
          eventSource.close();
          console.error(chalk.red(`\n❌ Error: ${data.error}`));
          process.exit(1);
      }
    };

  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
```

### 4.3 Health Check

```javascript
async function checkHealth() {
  const spinner = ora('Checking system health...').start();

  try {
    const response = await fetch(`${API_URL}/api/health`);
    const health = await response.json();

    spinner.stop();

    console.log(chalk.bold('\n🧠 System Status\n'));

    const statusIcon = health.status === 'ok' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
    console.log(`Status: ${statusIcon} ${health.status.toUpperCase()}`);

    console.log(chalk.gray('\nComponents:'));
    console.log(`  Ollama:   ${health.ollama ? chalk.green('✅') : chalk.red('❌')}`);
    console.log(`  ChromaDB: ${health.chromadb ? chalk.green('✅') : chalk.red('❌')}`);

    console.log(chalk.gray('\nModels:'));
    console.log(`  Proposer:   ${health.models.proposer}`);
    console.log(`  Skeptic:    ${health.models.skeptic}`);
    console.log(`  Embedding:  ${health.models.embedding}`);

    console.log(chalk.gray(`\nVersion: ${health.version}\n`));

  } catch (error) {
    spinner.fail('Failed to connect to API');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
```

### 4.4 List Models

```javascript
async function listModels() {
  const spinner = ora('Fetching models...').start();

  try {
    const response = await fetch(`${API_URL}/api/models`);
    const { models } = await response.json();

    spinner.stop();

    console.log(chalk.bold('\n📦 Available Ollama Models\n'));

    if (models.length === 0) {
      console.log(chalk.yellow('No models installed'));
      return;
    }

    models.forEach((model) => {
      const sizeGB = (model.size / 1e9).toFixed(1);
      console.log(`  ${chalk.cyan(model.name)}  ${chalk.gray(`${sizeGB} GB`)}`);
    });

    console.log('');

  } catch (error) {
    spinner.fail('Failed to fetch models');
    process.exit(1);
  }
}
```

### 4.5 List Traces

```javascript
async function listTraces(options) {
  const spinner = ora('Fetching traces...').start();

  try {
    const response = await fetch(`${API_URL}/api/traces?limit=${options.limit}`);
    const { traces, total } = await response.json();

    spinner.stop();

    console.log(chalk.bold(`\n📜 Debate Traces (${total} total)\n`));

    if (traces.length === 0) {
      console.log(chalk.yellow('No debates yet'));
      return;
    }

    traces.forEach((trace) => {
      const date = new Date(trace.createdAt).toLocaleDateString();
      const rating = trace.userRating ? `⭐ ${trace.userRating}/10` : '';
      const rounds = `${trace.totalRounds} rounds`;

      console.log(`  ${chalk.cyan(trace.id.slice(0, 8))}  ${chalk.gray(date)}  ${rounds}  ${rating}`);
      console.log(`  ${chalk.gray(trace.query.slice(0, 60))}...`);
      console.log('');
    });

  } catch (error) {
    spinner.fail('Failed to fetch traces');
    process.exit(1);
  }
}
```

### 4.6 Rate Trace

```javascript
async function rateTrace(id, score) {
  const spinner = ora('Submitting rating...').start();

  try {
    const response = await fetch(`${API_URL}/api/traces/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: parseInt(score) }),
    });

    if (!response.ok) {
      throw new Error('Failed to rate trace');
    }

    spinner.succeed('Rating submitted');

  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
```

---

## 5. Test Specifications

**Test file:** `apps/cli/__tests__/cli.test.js`  
**Framework:** Vitest + `supertest` (for API mocking)

### 5.1 Argument Parsing Tests

```javascript
describe('CLI Argument Parsing', () => {
  it('should parse query argument', () => {
    // Assert: query is extracted correctly
  });

  it('should default rounds to 3', () => {
    // Assert: Default config uses 3 rounds
  });

  it('should accept custom rounds', () => {
    // Assert: --rounds 5 sets rounds to 5
  });

  it('should accept model options', () => {
    // Assert: --proposer-model sets proposerModel
  });

  it('should reject invalid temperature', () => {
    // Assert: Throws error for temperature outside 0-2
  });
});
```

### 5.2 Debate Command Tests

```javascript
describe('tmde <query>', () => {
  it('should start a debate via API', async () => {
    // Assert: POST /api/reason called with correct payload
  });

  it('should stream SSE events', async () => {
    // Assert: Events are received and displayed
  });

  it('should show verbose output with --verbose flag', async () => {
    // Assert: Proposer and Skeptic chunks are displayed
  });

  it('should show only final answer with --quiet flag', async () => {
    // Assert: Only final answer displayed
  });

  it('should handle API errors', async () => {
    // Assert: Error message displayed, exit code 1
  });
});
```

### 5.3 Health Command Tests

```javascript
describe('tmde health', () => {
  it('should call GET /api/health', async () => {
    // Assert: API called
  });

  it('should display system status', async () => {
    // Assert: Status output shown
  });

  it('should handle connection errors', async () => {
    // Assert: Error message shown
  });
});
```

### 5.4 Models Command Tests

```javascript
describe('tmde models', () => {
  it('should call GET /api/models', async () => {
    // Assert: API called
  });

  it('should display model list', async () => {
    // Assert: Models listed
  });
});
```

### 5.5 Traces Command Tests

```javascript
describe('tmde traces', () => {
  it('should call GET /api/traces', async () => {
    // Assert: API called
  });

  it('should display trace list', async () => {
    // Assert: Traces listed with ID, date, rating
  });

  it('should respect --limit option', async () => {
    // Assert: ?limit=X in API call
  });
});
```

### 5.6 Rate Command Tests

```javascript
describe('tmde rate', () => {
  it('should call POST /api/traces/:id/rate', async () => {
    // Assert: API called with correct rating
  });

  it('should validate rating range (1-10)', async () => {
    // Assert: Error for rating outside range
  });

  it('should show success message', async () => {
    // Assert: "Rating submitted" displayed
  });
});
```

---

## 6. File Structure

```
apps/cli/
├── index.js               # Main entry point
├── package.json
└── __tests__/
    ├── cli.test.js
    └── fixtures/
        └── mock-api-responses.js
```

---

## 7. Acceptance Criteria

- [ ] All tests pass
- [ ] `tmde "query"` runs debate and streams output
- [ ] `--verbose` shows full debate transcript
- [ ] `--quiet` shows only final answer
- [ ] `--rounds` sets number of debate rounds
- [ ] `--proposer-model` and `--skeptic-model` work
- [ ] `tmde health` shows system status
- [ ] `tmde models` lists available Ollama models
- [ ] `tmde traces` lists past debates
- [ ] `tmde rate <id> <score>` rates a debate
- [ ] Colored output is readable
- [ ] Error messages are helpful
- [ ] Loading spinners work during async operations
- [ ] CLI exits with code 1 on error

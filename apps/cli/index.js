#!/usr/bin/env node
// ============================================================
// This Mind Does Not Exist — CLI
// ============================================================
// Command-line interface for the reasoning engine.
//
// Usage:
//   tmde "Your question here"              → Run a debate
//   tmde --rounds 5 "Your question"        → Set round count
//   tmde --proposer model --skeptic model   → Choose models
//   tmde --quiet "Your question"            → Only show final answer
//   tmde --verbose "Your question"          → Show full debate
//   tmde traces                             → List past debates
//   tmde rate <id> <score>                  → Rate a trace
//   tmde finetune --now                     → Trigger fine-tuning
//   tmde models                             → List available models
//   tmde health                             → Check system status
//
// The CLI connects to the Fastify API at API_URL (default: http://localhost:3001)
// ============================================================

const API_URL = process.env.TMDE_API_URL || 'http://localhost:3001';
const args = process.argv.slice(2);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  purple: '\x1b[35m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function error(...args) {
  console.error(colors.red, 'Error:', ...args, colors.reset);
}

// Parse arguments
let command = args[0];
let question = '';
let options = {
  rounds: 4,
  proposerModel: null,
  skepticModel: null,
  quiet: false,
  verbose: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    if (key === 'rounds') {
      options.rounds = parseInt(args[++i]) || 4;
    } else if (key === 'proposer') {
      options.proposerModel = args[++i];
    } else if (key === 'skeptic') {
      options.skepticModel = args[++i];
    } else if (key === 'quiet') {
      options.quiet = true;
    } else if (key === 'verbose') {
      options.verbose = true;
    }
  } else if (!command) {
    command = arg;
  } else {
    question += (question ? ' ' : '') + arg;
  }
}

// Health check
async function health() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    const data = await res.json();
    
    if (data.status === 'ok') {
      log(colors.green, '✅ System healthy');
      console.log(`   Ollama: ${data.ollama ? '✅ Connected' : '❌ Not connected'}`);
      console.log(`   Templates: ${data.templates || 0} indexed`);
      console.log(`   Version: ${data.version}`);
    } else {
      log(colors.yellow, '⚠️  System degraded');
      console.log(`   Ollama: ${data.ollama ? '✅ Connected' : '❌ Not connected'}`);
    }
  } catch (err) {
    error('Cannot connect to API at', API_URL);
    process.exit(1);
  }
}

// List models
async function listModels() {
  try {
    const res = await fetch(`${API_URL}/api/models`);
    const data = await res.json();
    
    if (data.models && data.models.length > 0) {
      log(colors.cyan, '🤖 Available Models:');
      data.models.forEach(m => {
        const size = m.size > 1024 * 1024 * 1024 
          ? `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
          : `${(m.size / (1024 * 1024)).toFixed(1)} MB`;
        console.log(`   ${colors.white}${m.name}${colors.reset} (${size})`);
      });
    } else {
      log(colors.yellow, '⚠️  No models found. Pull some models first:');
      console.log('   ollama pull qwen3:32b');
      console.log('   ollama pull llama3.3:70b');
    }
  } catch (err) {
    error('Failed to fetch models:', err.message);
    process.exit(1);
  }
}

// List traces
async function listTraces() {
  try {
    const res = await fetch(`${API_URL}/api/traces?limit=20`);
    const data = await res.json();
    
    if (data.traces && data.traces.length > 0) {
      log(colors.cyan, '📚 Recent Debates:');
      data.traces.forEach(t => {
        const date = new Date(t.createdAt).toLocaleDateString();
        const score = t.autoScore ? `${t.autoScore}/10` : 'N/A';
        console.log(`   ${colors.white}${t.id.slice(0, 8)}${colors.reset} | ${score} | ${date} | ${t.query.slice(0, 50)}...`);
      });
      console.log(`\n   Total: ${data.stats.totalTraces} debates`);
    } else {
      log(colors.yellow, '⚠️  No debates yet. Start one with: tmde "your question"');
    }
  } catch (err) {
    error('Failed to fetch traces:', err.message);
    process.exit(1);
  }
}

// Rate a trace
async function rateTrace(traceId, rating) {
  try {
    const res = await fetch(`${API_URL}/api/traces/${traceId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: parseInt(rating) }),
    });
    
    if (res.ok) {
      log(colors.green, `✅ Rated trace ${traceId.slice(0, 8)} as ${rating}/10`);
    } else {
      error('Failed to rate trace');
      process.exit(1);
    }
  } catch (err) {
    error('Failed to rate trace:', err.message);
    process.exit(1);
  }
}

// Trigger fine-tuning
async function triggerFineTune() {
  try {
    log(colors.yellow, '🎓 Starting fine-tuning... This may take a while.');
    const res = await fetch(`${API_URL}/api/finetune`, {
      method: 'POST',
    });
    const data = await res.json();
    
    if (data.status === 'no_training_data') {
      log(colors.yellow, '⚠️  Not enough high-quality debates (need 8+/10 rating).');
    } else {
      log(colors.green, `✅ Fine-tuning started: ${data.runId}`);
    }
  } catch (err) {
    error('Failed to start fine-tuning:', err.message);
    process.exit(1);
  }
}

// Run debate
async function runDebate(question) {
  if (!question) {
    error('Please provide a question');
    console.log('Usage: tmde "your question here"');
    process.exit(1);
  }

  try {
    log(colors.cyan, '🧠 Starting debate...');
    console.log(`   Question: "${question}"`);
    console.log(`   Rounds: ${options.rounds}`);

    // Start debate
    const startRes = await fetch(`${API_URL}/api/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        config: {
          maxRounds: options.rounds,
          proposerModel: options.proposerModel,
          skepticModel: options.skepticModel,
        },
      }),
    });

    if (!startRes.ok) {
      error('Failed to start debate:', startRes.statusText);
      process.exit(1);
    }

    const { traceId } = await startRes.json();
    console.log(`   Debate ID: ${traceId.slice(0, 8)}\n`);

    // Connect to SSE stream
    const eventSource = new EventSource(`${API_URL}/api/reason/${traceId}/stream`);
    let currentRound = 0;
    let finalAnswer = '';

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'rag_complete':
            if (options.verbose) log(colors.dim, '   📚 Templates retrieved');
            break;

          case 'round_start':
            currentRound = data.round;
            if (!options.quiet) {
              log(colors.magenta, `\n💬 Round ${currentRound}`);
              console.log('─'.repeat(50));
            }
            break;

          case 'proposer_chunk':
            if (options.verbose) {
              process.stdout.write(colors.purple + data.content + colors.reset);
            }
            break;

          case 'proposer_complete':
            if (!options.quiet) {
              log(colors.purple, '\n   ✅ Proposer done');
            }
            break;

          case 'skeptic_chunk':
            if (options.verbose) {
              process.stdout.write(colors.red + data.content + colors.reset);
            }
            break;

          case 'skeptic_complete':
            if (!options.quiet) {
              log(colors.red, '\n   ✅ Skeptic done');
            }
            break;

          case 'synthesis_start':
            if (!options.quiet) {
              log(colors.green, '\n✨ Synthesizing final answer...');
            }
            break;

          case 'synthesis_chunk':
            process.stdout.write(colors.green + data.content + colors.reset);
            finalAnswer += data.content;
            break;

          case 'synthesis_complete':
          case 'complete':
            if (options.quiet) {
              console.log(finalAnswer);
            } else {
              log(colors.green, '\n✅ Debate complete!');
              console.log(`   Trace ID: ${traceId.slice(0, 8)}`);
            }
            eventSource.close();
            process.exit(0);
            break;

          case 'error':
            error('Debate failed:', data.error);
            eventSource.close();
            process.exit(1);
            break;
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      error('Connection lost');
      process.exit(1);
    };

  } catch (err) {
    error('Failed to start debate:', err.message);
    process.exit(1);
  }
}

// Main command router
async function main() {
  switch (command) {
    case 'health':
      await health();
      break;

    case 'models':
    case 'list':
      await listModels();
      break;

    case 'traces':
      await listTraces();
      break;

    case 'rate':
      if (!args[1] || !args[2]) {
        error('Usage: tmde rate <trace_id> <score>');
        process.exit(1);
      }
      await rateTrace(args[1], args[2]);
      break;

    case 'finetune':
      await triggerFineTune();
      break;

    default:
      if (command) {
        await runDebate(command);
      } else {
        log(colors.cyan, '🧠 This Mind Does Not Exist — CLI');
        console.log('\nUsage:');
        console.log('  tmde "your question"              Run a debate');
        console.log('  tmde health                       Check system status');
        console.log('  tmde models                       List available models');
        console.log('  tmde traces                       List past debates');
        console.log('  tmde rate <id> <score>            Rate a debate');
        console.log('  tmde finetune                     Trigger fine-tuning');
        console.log('\nOptions:');
        console.log('  --rounds <n>        Number of debate rounds');
        console.log('  --proposer <model> Proposer model');
        console.log('  --skeptic <model>  Skeptic model');
        console.log('  --quiet            Show only final answer');
        console.log('  --verbose         Show full debate');
        console.log(`\nAPI: ${API_URL}`);
      }
  }
}

main();

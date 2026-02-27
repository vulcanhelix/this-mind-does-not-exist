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

// TODO: Implement CLI argument parsing (use commander or yargs)
// TODO: Implement SSE streaming for real-time debate output
// TODO: Implement colorized terminal output (chalk)
// TODO: Implement interactive rating prompt
// TODO: Implement trace listing with table formatting

console.log('🧠 This Mind Does Not Exist — CLI');
console.log('   Coming soon. Use the web UI at http://localhost:3000');
console.log('');
console.log('   API endpoint:', API_URL);

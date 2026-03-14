/**
 * playwright-mcp-orchestrator — entry point
 *
 * CLI usage:
 *   npx tsx src/index.ts [--agents N]
 *
 * This starts N @playwright/mcp instances all connected to your running Chrome.
 * Each agent gets its own port starting at 3200.
 *
 * Connect your AI agents:
 *   Agent 1: http://localhost:3200/mcp
 *   Agent 2: http://localhost:3201/mcp
 *   ...
 */

import { launchOrchestrator, shutdownOrchestrator } from './orchestrator.js';
import { printClaudeConfig } from './config-gen.js';

const args = process.argv.slice(2);
const countArg = args.indexOf('--agents');
const count = countArg !== -1 ? parseInt(args[countArg + 1], 10) : 2;

if (isNaN(count) || count < 1) {
  console.error('Usage: tsx src/index.ts [--agents N]');
  process.exit(1);
}

const handles = await launchOrchestrator(count);

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log('\n[orchestrator] Shutting down…');
  shutdownOrchestrator(handles);
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdownOrchestrator(handles);
  process.exit(0);
});

console.log('\n[orchestrator] Running. Press Ctrl+C to stop.');
console.log('[orchestrator] Agent MCP endpoints:');
handles.forEach(h => console.log(`  ${h.config.name}  →  ${h.url}`));
printClaudeConfig(handles);

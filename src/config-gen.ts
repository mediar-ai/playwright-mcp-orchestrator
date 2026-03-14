/**
 * Generates Claude Desktop / Claude Code MCP config snippets for the active agents.
 */

import { AgentHandle } from './orchestrator.js';

export function generateClaudeConfig(handles: AgentHandle[]): object {
  const mcpServers: Record<string, { url: string }> = {};
  for (const h of handles) {
    mcpServers[`playwright-${h.config.name}`] = { url: h.url };
  }
  return { mcpServers };
}

export function printClaudeConfig(handles: AgentHandle[]): void {
  const config = generateClaudeConfig(handles);
  console.log('\n[orchestrator] Claude MCP config snippet:');
  console.log(JSON.stringify(config, null, 2));
}

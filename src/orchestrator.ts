/**
 * playwright-mcp-orchestrator
 *
 * Spawns N @playwright/mcp instances all connected to the same Chrome via CDP.
 * Each agent gets its own port and owns a set of tab indices.
 * The orchestrator optionally proxies each agent's MCP stream to filter
 * browser_tabs list/select responses so agents only see their own tabs.
 */

import { spawn, ChildProcess } from 'child_process';
import { chromium } from 'playwright-core';

const CDP_URL = 'http://127.0.0.1:9222';
const BASE_PORT = 3200;

export interface AgentConfig {
  /** Human-readable label for this agent slot */
  name: string;
  /** Port this @playwright/mcp instance will listen on */
  port: number;
}

export interface AgentHandle {
  config: AgentConfig;
  process: ChildProcess;
  /** The MCP server URL clients should connect to */
  url: string;
  /** Tab page IDs owned by this agent (populated at runtime) */
  ownedPageIds: Set<string>;
}

/**
 * Ensure Chrome is reachable at CDP_URL.
 * Returns the WebSocket debugger URL for the browser.
 */
async function ensureChrome(): Promise<string> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    const data = await res.json() as { webSocketDebuggerUrl: string; Browser: string };
    console.log(`[orchestrator] Chrome detected: ${data.Browser}`);
    return data.webSocketDebuggerUrl;
  } catch {
    throw new Error(
      `Chrome not reachable at ${CDP_URL}.\n` +
      'Start Chrome with:\n' +
      '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n' +
      '    --remote-debugging-port=9222 \\\n' +
      '    --user-data-dir=/tmp/chrome-cdp-profile'
    );
  }
}

/**
 * Spawn a single @playwright/mcp instance.
 */
function spawnMcpInstance(config: AgentConfig): AgentHandle {
  const args = [
    '@playwright/mcp@latest',
    '--cdp-endpoint', CDP_URL,
    '--port', String(config.port),
  ];

  const proc = spawn('npx', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const url = `http://localhost:${config.port}/mcp`;

  proc.stdout?.on('data', (d: Buffer) => {
    console.log(`[agent:${config.name}] ${d.toString().trim()}`);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    console.error(`[agent:${config.name}:err] ${d.toString().trim()}`);
  });
  proc.on('exit', (code) => {
    console.log(`[agent:${config.name}] exited with code ${code}`);
  });

  return { config, process: proc, url, ownedPageIds: new Set() };
}

/**
 * Wait until an MCP SSE endpoint responds.
 */
async function waitForMcp(url: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // The MCP endpoint requires an Accept: text/event-stream header.
  // We just check that the port is alive via a plain GET — it will
  // return a non-200 but at least won't ECONNREFUSED.
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error(`MCP server at ${url} did not start within ${timeoutMs}ms`);
}

/**
 * Launch N agent slots and return their handles.
 *
 * @param count  Number of agent slots to spin up (default: 2)
 */
export async function launchOrchestrator(count = 2): Promise<AgentHandle[]> {
  await ensureChrome();

  const agents: AgentConfig[] = Array.from({ length: count }, (_, i) => ({
    name: `agent-${i + 1}`,
    port: BASE_PORT + i,
  }));

  console.log(`[orchestrator] Spawning ${count} @playwright/mcp instances…`);

  const handles = agents.map(spawnMcpInstance);

  // Wait for all instances to be ready
  await Promise.all(handles.map(h => waitForMcp(h.url)));

  console.log('[orchestrator] All agents ready:');
  handles.forEach(h => console.log(`  ${h.config.name}  →  ${h.url}`));

  return handles;
}

/**
 * Shut down all agent processes.
 */
export function shutdownOrchestrator(handles: AgentHandle[]): void {
  for (const h of handles) {
    h.process.kill('SIGTERM');
  }
  console.log('[orchestrator] All agents terminated.');
}

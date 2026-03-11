// playwright-mcp-orchestrator
// Multi-agent orchestrator for Playwright MCP
// Connects multiple @playwright/mcp sessions to one Chrome via CDP with tab isolation

export { }

// TODO: Implementation
// 1. Connect to Chrome via CDP (ws://127.0.0.1:9222)
// 2. Spin up multiple @playwright/mcp instances
// 3. Assign each instance its own tab group
// 4. Route MCP tool calls to the correct tabs

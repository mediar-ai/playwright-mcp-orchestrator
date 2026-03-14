/**
 * Tab ownership tracker.
 *
 * Since all @playwright/mcp instances share the same Chrome context via CDP,
 * they all see all open tabs.  This module tracks which Chrome page IDs
 * belong to which agent so we can:
 *   1. Warn when an agent accidentally touches another agent's tab.
 *   2. (Future) filter browser_tabs list responses per agent via the proxy layer.
 */

import { AgentHandle } from './orchestrator.js';

export interface TabRecord {
  pageId: string;
  agentName: string;
  url: string;
  createdAt: number;
}

export class TabTracker {
  private records = new Map<string, TabRecord>();

  /**
   * Register a new tab as owned by a specific agent.
   */
  register(pageId: string, agentName: string, url: string): void {
    this.records.set(pageId, { pageId, agentName, url, createdAt: Date.now() });
  }

  /**
   * Remove a tab record (e.g. when the tab is closed).
   */
  unregister(pageId: string): void {
    this.records.delete(pageId);
  }

  /**
   * Return all tab records owned by a specific agent.
   */
  tabsForAgent(agentName: string): TabRecord[] {
    return [...this.records.values()].filter(r => r.agentName === agentName);
  }

  /**
   * Return the owning agent for a page ID, or undefined if untracked.
   */
  ownerOf(pageId: string): string | undefined {
    return this.records.get(pageId)?.agentName;
  }

  /**
   * Snapshot of all tracked tabs for debugging.
   */
  dump(): TabRecord[] {
    return [...this.records.values()];
  }
}

/**
 * Given raw CDP tab data (from /json), build initial ownership.
 * Tabs that already existed before the orchestrator started are unowned.
 */
export async function snapshotExistingTabs(
  cdpUrl: string,
  tracker: TabTracker
): Promise<void> {
  try {
    const res = await fetch(`${cdpUrl.replace('/json/version', '')}/json`);
    const tabs = await res.json() as Array<{ id: string; url: string; title: string }>;
    console.log(`[tab-tracker] ${tabs.length} pre-existing tabs (unowned)`);
    // We intentionally don't register pre-existing tabs — they belong to no agent.
  } catch (e) {
    console.warn('[tab-tracker] Could not snapshot existing tabs:', e);
  }
}

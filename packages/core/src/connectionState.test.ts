import { describe, expect, it } from "vitest";
import { connectionState, type ConnectionInput, type LocalConnectionState } from "./connectionState";

const NOW = new Date("2026-10-05T18:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const idle: LocalConnectionState = { refreshing: false, linking: false, justReconnected: false, refreshFailed: false };
const conn = (status: string, badge: ConnectionInput["badge"], lastSyncedAt: string | null): ConnectionInput => ({
  institutionName: "Wealthsimple",
  status,
  badge,
  lastSyncedAt,
});

describe("connectionState", () => {
  it("keeps a healthy connection quiet", () => {
    const s = connectionState(conn("healthy", "good", hoursAgo(0.2)), idle, NOW);
    expect(s).toMatchObject({ level: "quiet", statusLine: "Synced 12m ago", needsAttention: false });
    expect(s.notice).toBeUndefined();
    expect(s.action).toBeUndefined();
  });

  it("colors 6–48h behind without a notice", () => {
    const s = connectionState(conn("healthy", "warning", hoursAgo(9)), idle, NOW);
    expect(s).toMatchObject({ level: "info", tone: "warning", needsAttention: false });
    expect(s.notice).toBeUndefined();
  });

  it("offers a sync for a stale connection, then sign-in once a manual refresh failed", () => {
    const stale = conn("healthy", "serious", hoursAgo(80));
    expect(connectionState(stale, idle, NOW).action).toEqual({ kind: "refresh", label: "Sync now" });
    expect(connectionState(stale, { ...idle, refreshFailed: true }, NOW).action).toEqual({ kind: "signIn", label: "Sign in again" });
  });

  it("blocks an expired sign-in: dimmed, collapsed, sorted first", () => {
    const s = connectionState(conn("login_required", "critical", hoursAgo(3)), idle, NOW);
    expect(s).toMatchObject({ level: "blocked", tone: "negative", dimBalances: true, collapsed: true, rank: 0, statusLine: "Paused · 3h ago" });
    expect(s.action).toEqual({ kind: "signIn", label: "Sign in" });
  });

  it("offers Disconnect beside Reconnect for revoked access", () => {
    const s = connectionState(conn("revoked", "critical", hoursAgo(30)), idle, NOW);
    expect(s.action?.label).toBe("Reconnect");
    expect(s.secondaryAction).toEqual({ kind: "remove", label: "Disconnect" });
  });

  it("retries a bank error first and escalates to sign-in after a day down", () => {
    expect(connectionState(conn("error", "critical", hoursAgo(5)), idle, NOW)).toMatchObject({ level: "act", action: { kind: "refresh", label: "Retry" } });
    expect(connectionState(conn("error", "critical", hoursAgo(30)), idle, NOW).action).toEqual({ kind: "signIn", label: "Sign in again" });
  });

  it("asks to renew access that's about to end", () => {
    expect(connectionState(conn("pending_expiration", "warning", hoursAgo(1)), idle, NOW)).toMatchObject({ level: "act", action: { kind: "signIn", label: "Renew" } });
  });

  it("explains an import in progress without an action", () => {
    const s = connectionState(conn("healthy", "syncing", hoursAgo(0.3)), idle, NOW);
    expect(s).toMatchObject({ level: "info", tone: "info", needsAttention: false });
    expect(s.action).toBeUndefined();
  });

  it("layers local states over the server state", () => {
    const broken = conn("login_required", "critical", hoursAgo(3));
    expect(connectionState(broken, { ...idle, linking: true }, NOW)).toMatchObject({ actionPending: true, notice: { title: "Waiting for Wealthsimple…" } });
    expect(connectionState(conn("healthy", "good", hoursAgo(0)), { ...idle, justReconnected: true }, NOW)).toMatchObject({ tone: "brand", rank: 0, needsAttention: false });
  });

  it("accepts Date timestamps as well as ISO strings", () => {
    const s = connectionState({ ...conn("healthy", "good", null), lastSyncedAt: new Date(NOW - 2 * 3_600_000) }, idle, NOW);
    expect(s.statusLine).toBe("Synced 2h ago");
  });
});

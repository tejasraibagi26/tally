import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: () => {} }));
const { requestLogContext } = await import("./log");

const at = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  requestLogContext(new Request(`https://tally.test${path}`, { method, headers }));

describe("requestLogContext", () => {
  it("reads the app's headers for a mobile request", () => {
    const ctx = at("/api/transactions", {
      "x-tally-client": "mobile",
      "x-tally-app-version": "2.20.7",
      "x-tally-build": "abc1234",
      "x-tally-platform": "ios",
      "x-tally-os-version": "26.1",
      "x-tally-device": "iPhone 17 Pro",
      "x-tally-timezone": "America/Toronto",
      authorization: "Bearer t",
      "x-vercel-id": "yul1::abc",
      "user-agent": "Expo/1",
    });
    expect(ctx).toEqual({
      client: "mobile",
      requestId: "yul1::abc",
      method: "GET",
      path: "/api/transactions",
      timezone: "America/Toronto",
      appVersion: "2.20.7",
      buildSha: "abc1234",
      platform: "ios",
      osVersion: "26.1",
      device: "iPhone 17 Pro",
    });
  });

  it("tells web, API tokens, Plaid and cron apart", () => {
    expect(at("/api/accounts", { "sec-fetch-site": "same-origin", "user-agent": "Mozilla/5.0" })).toMatchObject({ client: "web", userAgent: "Mozilla/5.0" });
    expect(at("/api/v1/transactions", { authorization: "Bearer tly_x" }).client).toBe("api");
    expect(at("/api/plaid/webhook", {}, "POST").client).toBe("plaid");
    expect(at("/api/cron/nightly", { authorization: "Bearer cron" }).client).toBe("cron");
    expect(at("/api/anything").client).toBe("unknown");
  });

  it("caps header lengths and leaves out what wasn't sent", () => {
    const ctx = at("/api/x", { "x-tally-client": "mobile", "x-tally-device": "d".repeat(500) });
    expect(ctx.device).toHaveLength(60);
    expect(ctx).not.toHaveProperty("appVersion");
  });
});

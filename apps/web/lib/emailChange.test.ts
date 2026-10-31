import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailChangeToken, verifyEmailChangeToken } from "./emailChange";

describe("email change tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("round-trips the user and both addresses", async () => {
    const token = await emailChangeToken("u1", "old@example.com", "new@example.com");
    expect(await verifyEmailChangeToken(token)).toEqual({ userId: "u1", from: "old@example.com", to: "new@example.com" });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await emailChangeToken("u1", "old@example.com", "new@example.com");
    vi.stubEnv("AUTH_SECRET", "other-secret");
    expect(await verifyEmailChangeToken(token)).toBeNull();
  });

  it("expires after an hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const token = await emailChangeToken("u1", "old@example.com", "new@example.com");
    vi.setSystemTime(new Date("2026-11-01T01:00:30Z"));
    expect(await verifyEmailChangeToken(token)).toBeNull();
  });
});

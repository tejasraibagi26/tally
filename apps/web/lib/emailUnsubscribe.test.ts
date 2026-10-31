import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken } from "./emailUnsubscribe";

const UID = "6f1c2b9e-3a4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("verifies its own token for the same user only", () => {
    const token = unsubscribeToken(UID);
    expect(verifyUnsubscribeToken(UID, token)).toBe(true);
    expect(verifyUnsubscribeToken("00000000-0000-4000-8000-000000000000", token)).toBe(false);
  });

  it("rejects a valid token with junk appended", () => {
    expect(verifyUnsubscribeToken(UID, `${unsubscribeToken(UID)}zz`)).toBe(false);
  });

  it("accepts pre-2.9.2 tokens only until the cutoff", () => {
    const legacy = createHmac("sha256", "test-secret").update(UID).digest("hex");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));
    expect(verifyUnsubscribeToken(UID, legacy)).toBe(true);
    vi.setSystemTime(new Date("2027-02-01T00:00:00Z"));
    expect(verifyUnsubscribeToken(UID, legacy)).toBe(false);
  });
});

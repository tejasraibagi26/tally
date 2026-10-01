import { describe, it, expect } from "vitest";
import { todayInZone, monthStartInZone, isValidTimeZone } from "./zonedDate";

describe("zoned dates", () => {
  // 2026-10-01T00:30Z is still 8:30 PM on Sep 30 in Toronto.
  const evening = new Date("2026-10-01T00:30:00Z");
  it("keeps the local day and month after UTC midnight", () => {
    expect(todayInZone("America/Toronto", evening)).toBe("2026-09-30");
    expect(monthStartInZone("America/Toronto", evening)).toBe("2026-09-01");
  });
  it("rolls over at local midnight", () => {
    const midnight = new Date("2026-10-01T04:00:00Z");
    expect(monthStartInZone("America/Toronto", midnight)).toBe("2026-10-01");
  });
  it("matches UTC for UTC", () => {
    expect(monthStartInZone("UTC", evening)).toBe("2026-10-01");
  });
  it("validates zone names", () => {
    expect(isValidTimeZone("America/Vancouver")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});

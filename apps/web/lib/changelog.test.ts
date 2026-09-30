import { describe, it, expect } from "vitest";
import { CHANGELOG } from "./changelog";
import { APP_VERSION } from "./version";

describe("CHANGELOG", () => {
  it("has an entry for the current APP_VERSION at the top", () => {
    expect(CHANGELOG[0]?.version).toBe(APP_VERSION);
  });
  it("lists each version once, newest first", () => {
    const versions = CHANGELOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    const parse = (v: string) => v.split(".").map(Number);
    for (let i = 1; i < versions.length; i++) {
      const [a, b] = [parse(versions[i - 1]!), parse(versions[i]!)];
      const newer = a[0]! !== b[0]! ? a[0]! > b[0]! : a[1]! !== b[1]! ? a[1]! > b[1]! : a[2]! > b[2]!;
      expect(newer, `${versions[i - 1]} should be newer than ${versions[i]}`).toBe(true);
    }
  });
});

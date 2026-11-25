// k.cli "Output": --format=compact|json|pretty; default compact when stdout is not a TTY or KEEL_AGENT=1, else pretty.
import { describe, expect, it } from "vitest";
import { SEED, dirtyProject, keel, parseJsonLines } from "./fixtures";

void SEED;
const files = dirtyProject(2);
const isJsonLines = (s: string): boolean => {
  try {
    parseJsonLines(s);
    return s.length > 0;
  } catch {
    return false;
  }
};

describe("k.cli format selection", () => {
  it("--format=json selects NDJSON, --format=compact selects compact lines, and --format=pretty differs from compact", async () => {
    const j = await keel(["check", "--format=json"], { files });
    const c = await keel(["check", "--format=compact"], { files, tty: true });
    const p = await keel(["check", "--format=pretty"], { files });
    expect(isJsonLines(j.stdout)).toBe(true);
    expect(isJsonLines(c.stdout)).toBe(false);
    expect(p.stdout).not.toBe(c.stdout);
  });

  it("the default is compact when stdout is not a TTY", async () => {
    const d = await keel(["check"], { files, tty: false });
    const c = await keel(["check", "--format=compact"], { files, tty: false });
    expect(d.stdout).toBe(c.stdout);
  });

  it("the default is compact when KEEL_AGENT=1 even on a TTY", async () => {
    const d = await keel(["check"], { files, tty: true, env: { KEEL_AGENT: "1" } });
    const c = await keel(["check", "--format=compact"], { files, tty: true });
    expect(d.stdout).toBe(c.stdout);
  });

  it("the default is pretty on a TTY without KEEL_AGENT", async () => {
    const d = await keel(["check"], { files, tty: true, env: {} });
    const p = await keel(["check", "--format=pretty"], { files, tty: true });
    expect(d.stdout).toBe(p.stdout);
  });
});

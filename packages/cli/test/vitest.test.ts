// `keel test` runs vitest programmatically on io.cwd with KEEL_TEST=1 and reports OUTPUT.md records.
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const tiny = new URL("./fixtures/tiny", import.meta.url).pathname;
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");

describe("keel test", () => {
  it("runs the project's tests: one T0001 per failure at its app frame, compact diff as fix, trailer, exit 1", async () => {
    const r = await run(["test"], { cwd: tiny, files: [{ path: "vitest.config.ts", source: "" }] });
    expect(r.code).toBe(1);
    const out = lines(r.stdout);
    const diags = out.filter((l) => l.startsWith("T0001 "));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatch(/^T0001 sum\.fixture\.ts:\d+:\d+ fails on purpose: expected 2 to be 3/);
    expect(out).toContain("  fix: - 3");
    expect(out.at(-1)).toBe("fail test 3 tests, 1 failed, 0 skipped");
  }, 30_000);

  it("a path that matches no test file is one T0001 and exit 1, never a green empty run", async () => {
    const r = await run(["test", "no-such-file"], { cwd: tiny, files: [{ path: "vitest.config.ts", source: "" }] });
    expect(r.code).toBe(1);
    const out = lines(r.stdout);
    expect(out.filter((l) => l.startsWith("T0001 "))).toEqual(["T0001 no test ran: vitest ended the run as failed"]);
    expect(out.at(-1)).toBe("fail test 0 tests, 0 failed, 0 skipped");
  }, 30_000);

  it("a project without tests is the empty run and never starts vitest", async () => {
    const r = await run(["test"], { cwd: "/nowhere", files: [{ path: "src/a.ts", source: "export const a = 1\n" }] });
    expect(r).toEqual({ code: 0, stdout: "ok test 0 tests, 0 failed, 0 skipped\n", stderr: "" });
  });
});

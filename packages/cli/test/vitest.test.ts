// `keel test` runs vitest programmatically on io.cwd with KEEL_TEST=1 and reports OUTPUT.md records.
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const tiny = new URL("./fixtures/tiny", import.meta.url).pathname;
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");

describe("keel test", () => {
  it("runs the project's tests: one T0001 per failure, trailer with counts, exit 1", async () => {
    const r = await run(["test"], { cwd: tiny, files: [{ path: "vitest.config.ts", source: "" }] });
    expect(r.code).toBe(1);
    const out = lines(r.stdout);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^T0001 sum\.fixture\.ts:\d+:\d+ fails on purpose: /);
    expect(out[1]).toBe("fail test 3 tests, 1 failed, 0 skipped");
  }, 30_000);

  it("a project without tests is the empty run and never starts vitest", async () => {
    const r = await run(["test"], { cwd: "/nowhere", files: [{ path: "src/a.ts", source: "export const a = 1\n" }] });
    expect(r).toEqual({ code: 0, stdout: "ok test 0 tests, 0 failed, 0 skipped\n", stderr: "" });
  });
});

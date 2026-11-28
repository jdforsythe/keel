// docs/OUTPUT.md Server log: when the sink's `write` throws on the last `diag`, stderr gets one fixed `keel.unexpected`
// record in the log's own format (compact or json), once per process, holding no value. Each case loads the module
// fresh, as a new process would.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let stderr: string[] = [];
beforeEach(() => {
  stderr = [];
  vi.resetModules();
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  });
});
afterEach(() => void vi.restoreAllMocks());

describe("logUnwritable", () => {
  it("writes the compact record once per process", async () => {
    const { logUnwritable } = await import("../src/internal/logUnwritable.ts");
    logUnwritable("compact");
    logUnwritable("compact");
    expect(stderr).toEqual(["keel.unexpected log write threw, records lost (once per process)\n"]);
  });

  it("writes one json record when the log format is json", async () => {
    const { logUnwritable } = await import("../src/internal/logUnwritable.ts");
    logUnwritable("json");
    logUnwritable("json");
    expect(stderr).toHaveLength(1);
    expect(stderr[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(stderr[0] ?? "")).toEqual({
      kind: "diag",
      code: "keel.unexpected",
      message: "log write threw, records lost (once per process)",
      see: expect.any(String),
    });
  });

  it("writes nothing and does not throw when stderr's write throws", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("closed");
    });
    const { logUnwritable } = await import("../src/internal/logUnwritable.ts");
    expect(() => logUnwritable("json")).not.toThrow();
  });
});

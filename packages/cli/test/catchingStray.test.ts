import path from "node:path";
import { describe, expect, it } from "vitest";
import { catchingStray } from "../src/internal/catchingStray.ts";

const root = path.join(import.meta.dirname, "..");
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("catchingStray", () => {
  it("returns the value and no diagnostic when the work ends cleanly", async () => {
    expect(await catchingStray(root, async () => 7)).toEqual({ value: 7, strays: [] });
  });

  it("turns an error thrown outside any test into one T0001 at its file, instead of a process crash", async () => {
    const r = await catchingStray(root, async () => {
      setTimeout(() => {
        throw Object.assign(new Error("setTypeOfService failed\nsecond line"), { code: "EINVAL" });
      }, 5);
      await pause(60);
      return "done";
    });
    expect(r.value).toBe("done");
    expect(r.strays).toEqual([
      {
        kind: "diag",
        code: "T0001",
        path: "test/catchingStray.test.ts",
        line: expect.any(Number),
        col: expect.any(Number),
        message: "uncaught: EINVAL setTypeOfService failed",
      },
    ]);
  });

  it("reports an unhandled rejection and an error the work threw, each once", async () => {
    const r = await catchingStray(root, async () => {
      void Promise.reject(new Error("late rejection"));
      await pause(30);
      throw new Error("work failed");
    });
    expect(r.value).toBeUndefined();
    expect(r.strays.map((d) => d.message)).toEqual(["uncaught: late rejection", "uncaught: work failed"]);
  });

  it("skips a node_modules first frame and locates the error at its first app frame", async () => {
    const r = await catchingStray(root, async () => {
      const e = new Error("socket closed");
      e.stack = [
        "Error: socket closed",
        `    at onEnd (${root}/node_modules/dep/index.js:3:5)`,
        `    at run (${root}/test/catchingStray.test.ts:61:9)`,
      ].join("\n");
      throw e;
    });
    expect(r.strays).toEqual([
      {
        kind: "diag",
        code: "T0001",
        path: "test/catchingStray.test.ts",
        line: 61,
        col: 9,
        message: "uncaught: socket closed",
      },
    ]);
  });

  it("names a message without a stack and leaves no handler behind", async () => {
    const before = [process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")];
    const r = await catchingStray(root, async () => {
      throw "plain text";
    });
    expect(r.strays).toEqual([{ kind: "diag", code: "T0001", message: "uncaught: plain text" }]);
    expect([process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")]).toEqual(before);
  });
});

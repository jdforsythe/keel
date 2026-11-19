// @vitest-environment happy-dom
// Spec: k.topology Runners, clause "A `run` that rejects before `signal` aborts is a `keel.unexpected` `diag` and runs again 1,000 ms later on `ctx.clock`."
// Seed 1337 (fc.assert below). The restart delay is observed on the sim clock only; the diag is a JSON log line with kind "diag".
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, flush, pageManifest, simCtx } from "./topology-fixtures.ts";

describe("k.topology: runner rejection", () => {
  test("A `run` that rejects before `signal` aborts is a `keel.unexpected` `diag` and runs again 1,000 ms later on `ctx.clock`.", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{1,12}$/),
        fc.integer({ min: 1, max: 3 }),
        async (message, rejections) => {
          const ctx = simCtx();
          const lines: string[] = [];
          let starts = 0;
          const run = (_ctx: unknown, signal: AbortSignal): Promise<void> => {
            starts++;
            return starts <= rejections
              ? Promise.reject(new Error(message))
              : new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
          };
          const app = await createAppLoose({
            topology: topology({ x: { modules: ["a"], adapter: "node" } }),
            routes: pageManifest("a", "/a", "A"),
            ctx,
            mode: "dev",
            log: { format: "json", write: (l: string) => void lines.push(l) },
            runners: { a: [{ run }] },
          });
          await flush();
          const diags = (): unknown[] =>
            lines
              .map((l): unknown => JSON.parse(l))
              .filter((v) => typeof v === "object" && v !== null && "kind" in v && v.kind === "diag");
          expect(starts).toBe(1);
          expect(diags()).toHaveLength(1);
          expect(JSON.stringify(diags()[0])).toContain("keel.unexpected");
          for (let i = 1; i <= rejections; i++) {
            ctx.clock.advance(999);
            await flush();
            expect(starts).toBe(i);
            ctx.clock.advance(1);
            await flush();
            expect(starts).toBe(i + 1);
          }
          expect(diags()).toHaveLength(rejections);
          for (const d of diags()) expect(JSON.stringify(d)).toContain("keel.unexpected");
          await app.close?.();
        },
      ),
      { seed: SEED, numRuns: 5 },
    );
  }, 60_000);
});

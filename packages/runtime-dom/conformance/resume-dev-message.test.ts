// @vitest-environment happy-dom
// Spec: k.errors, clause "With `mode: 'dev'`, the root fallback `resume` renders in place of an island whose handler throws holds the error's message; without `mode` it holds only `keel.unexpected`."
// Seed 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { clone, on, resume, template } from "@keel/runtime-dom/ops";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { click, flush } from "./fixtures.ts";

const SEED = 1337;
const HTML = '<div data-k-island="A"><button id="a.boom" data-k="a.boom">boom</button></div>';
const STATE = '<script type="application/json" id="k-state">{"stores":{},"islands":{"A":{}}}</script>';
const T = template(HTML);

function island(msg: string) {
  return (): Node => {
    const root = clone(T);
    on("a.boom", "click", () => {
      throw new Error(msg);
    });
    return root;
  };
}

async function run(msg: string, mode: "dev" | "production" | undefined) {
  document.body.innerHTML = HTML + STATE;
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  resume(document.body, { A: island(msg) }, mode === undefined ? { ctx } : { ctx, mode });
  const btn = document.querySelector("#a\\.boom");
  if (btn === null) throw new Error("fixture: missing a.boom");
  click(btn);
  await flush();
  const text = document.querySelector('pre[data-k-error="a.boom"]')?.textContent;
  const reported = events.flatMap((e) => (e.kind === "error" ? [e.error] : []));
  document.body.innerHTML = "";
  return { text, reported };
}

describe("k.errors: with mode dev, the root fallback resume renders holds the error's message", () => {
  it("with mode dev, the fallback in place of the island holds the message the observer receives", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 20 }), async (tail) => {
        const msg = `leak-${tail}`;
        const { text, reported } = await run(msg, "dev");
        expect(reported).toHaveLength(1);
        expect(reported[0]?.code).toBe("keel.unexpected");
        expect(reported[0]?.message).toContain(msg);
        expect(text).toBe(reported[0]?.message);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("without mode, and with mode production, the fallback holds only keel.unexpected and not the message", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.constantFrom("production" as const, undefined),
        async (tail, mode) => {
          const msg = `leak-${tail}`;
          const { text, reported } = await run(msg, mode);
          expect(reported).toHaveLength(1);
          expect(reported[0]?.message).toContain(msg);
          expect(text).toBe("keel.unexpected");
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});

// Spec: k.ctx, clause "Ctxs created before and after `register(name)` both reach it in real, shell, and sim."
// fast-check seed: 1337
import { createCtx, register } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const modes: readonly ("real" | "shell" | "sim")[] = ["real", "shell", "sim"];
const FC = { seed: 1337, numRuns: 25 };

type Tagged = { readonly tag: string; readonly seed: unknown };
const nameArb = fc.stringMatching(/^[a-z]{3,10}$/);

describe("Ctxs created before and after `register(name)` both reach it in real, shell, and sim.", () => {
  for (const mode of modes) {
    it(`A ctx created before register(name) and one created after both reach it in ${mode}`, () => {
      fc.assert(
        fc.property(nameArb, fc.integer({ min: 0, max: 1_000_000 }), (suffix, seed) => {
          const name = `c138.${mode}.${suffix}.${seed}`;
          const before = createCtx({ mode, seed });
          const access = register(name, {
            real: (opts: { seed: unknown }): Tagged => ({ tag: "real", seed: opts.seed }),
            shell: (opts: { seed: unknown }): Tagged => ({ tag: "shell", seed: opts.seed }),
            sim: (opts: { seed: unknown }): Tagged => ({ tag: "sim", seed: opts.seed }),
          });
          const after = createCtx({ mode, seed });
          const b = access(before);
          const a = access(after);
          expect(b.tag).toBe(mode);
          expect(a.tag).toBe(mode);
          expect(b.seed).toBeDefined();
          expect(a.seed).toBeDefined();
          expect(typeof b.seed).toBe("number");
          expect(typeof a.seed).toBe("number");
          // same ctx seed and name derive the same factory seed
          expect(a.seed).toBe(b.seed);
        }),
        FC,
      );
    });
  }
});

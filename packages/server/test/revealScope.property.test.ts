// @vitest-environment node
// k.privacy Server log: a `Secret` made outside a scope and revealed inside a request or runner `run` joins that
// scope's set with exactly its written values; each `Secret` is walked once per set; outside every scope a reveal
// reads nothing and keeps nothing; the byte cap holds for revealed values; overlapping scopes do not share. Seed 1337.
import { type Secret, reveal, s } from "@keel/schema";
import { secretWalk } from "@keel/schema/internal";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { noteRequestSecrets } from "../src/internal/noteRequestSecrets.ts";
import { notedSecrets } from "../src/internal/notedSecrets.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { requestSecrets } from "../src/internal/requestSecrets.ts";
import { tallyOf } from "../src/internal/tallyOf.ts";

const SEED = 1337;
const value = fc.stringMatching(/^v[a-z0-9-]{3,16}$/);
const shape = s.secret(s.object({ key: s.string(), n: s.int(), flag: s.boolean(), tags: s.record(s.string()) }));

/** A `Secret` made outside every scope, as at startup. */
const madeOutside = <T>(r: { ok: true; value: Secret<T> } | { ok: false }): Secret<T> => {
  if (!r.ok) throw new Error("parse failed");
  return r.value;
};

beforeAll(() => {
  noteRequestSecrets();
});

describe("reveal inside a scope", () => {
  it("adds exactly the secret's written values and the empty string to the scope's set", () => {
    fc.assert(
      fc.property(
        value,
        fc.integer(),
        fc.boolean(),
        fc.dictionary(value, value, { maxKeys: 4 }),
        (key, n, flag, tags) => {
          const made = madeOutside(shape.parse({ key, n, flag, tags }));
          const into = new Set<string>();
          requestSecrets.run(into, () => reveal(made));
          expect(into).toEqual(new Set(["", ...secretWalk(made).values]));
          expect(into.has("flag")).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("walks a Secret once per set: a repeat reveal reads only the set's WeakSet", () => {
    const made = madeOutside(s.secret(s.string()).parse("once-4c2a9e"));
    const into = new Set<string>();
    requestSecrets.run(into, () => {
      reveal(made);
      expect(notedSecrets.get(into)?.has(made)).toBe(true);
      into.clear();
      reveal(made);
    });
    expect(into.size).toBe(0);
    const fresh = new Set<string>();
    requestSecrets.run(fresh, () => reveal(made));
    expect(fresh.has("once-4c2a9e")).toBe(true);
  });

  it("a Secret made in the scope is noted when made, so its reveal there walks nothing", () => {
    const into = new Set<string>();
    requestSecrets.run(into, () => {
      const made = madeOutside(s.secret(s.string()).parse("made-in-7b1d"));
      into.clear();
      reveal(made);
    });
    expect(into.size).toBe(0);
  });
});

describe("reveal outside every scope", () => {
  it("adds nothing, and a later scope still walks the secret when it reveals it", () => {
    fc.assert(
      fc.property(value, (raw) => {
        const made = madeOutside(s.secret(s.string()).parse(raw));
        expect(reveal(made)).toBe(raw);
        const into = new Set<string>();
        expect(notedSecrets.get(into)).toBeUndefined();
        requestSecrets.run(into, () => reveal(made));
        expect(into.has(raw)).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("makes no per-set entry when no scope runs", () => {
    const made = madeOutside(s.secret(s.string()).parse("none-3e8f"));
    const into = new Set<string>();
    requestSecrets.run(into, () => undefined);
    reveal(made);
    expect(notedSecrets.get(into)).toBeUndefined();
    expect(into.size).toBe(0);
  });
});

describe("the byte cap holds for revealed values", () => {
  it("a revealed secret that takes a set past 65,536 bytes puts it past its cap, keeps that value and no later one", () => {
    const into = new Set<string>();
    holdSecrets(
      into,
      Array.from({ length: 8_192 }, (_, i) => `v${String(i).padStart(7, "0")}`),
    );
    expect(tallyOf(into).bytes).toBe(65_536);
    expect(pastCap.has(into)).toBe(false);
    const made = madeOutside(s.secret(s.string()).parse("one-more-5a6b"));
    requestSecrets.run(into, () => reveal(made));
    expect(pastCap.has(into)).toBe(true);
    expect(into.has("one-more-5a6b")).toBe(true);
    const later = madeOutside(s.secret(s.string()).parse("later-9f0e"));
    requestSecrets.run(into, () => reveal(later));
    expect(into.has("later-9f0e")).toBe(false);
  });

  it("a revealed secret of 65,536 bytes holds the set at its cap, and one of 65,537 puts it past", () => {
    const reveals = (values: string[]): Set<string> => {
      const made = madeOutside(s.secret(s.array(s.string())).parse(values));
      const into = new Set<string>();
      requestSecrets.run(into, () => reveal(made));
      return into;
    };
    const at = reveals(["abcdefghij".repeat(6_553), "abcdef"]);
    expect(tallyOf(at).bytes).toBe(65_536);
    expect(pastCap.has(at)).toBe(false);
    expect(pastCap.has(reveals(["abcdefghij".repeat(6_553), "abcdefg"]))).toBe(true);
  });
});

describe("overlapping scopes", () => {
  it("each holds only the secrets it revealed, however their steps interleave", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }), value, async (steps, raw) => {
        const made = madeOutside(s.secret(s.string()).parse(`ovl-${raw}`));
        const revealing = new Set<string>();
        const quiet = new Set<string>();
        const tick = (): Promise<void> => new Promise((done) => setImmediate(done));
        await Promise.all([
          requestSecrets.run(revealing, async () => {
            for (const step of steps) {
              await tick();
              if (step) reveal(made);
            }
            reveal(made);
          }),
          requestSecrets.run(quiet, async () => {
            for (const _ of steps) await tick();
          }),
        ]);
        expect(revealing.has(`ovl-${raw}`)).toBe(true);
        expect(quiet.size).toBe(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

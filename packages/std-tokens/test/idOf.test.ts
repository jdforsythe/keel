// Seed 1337. For any string, `idOf` is `ok` exactly when `check` reaches `find`, with the same id, and a result never
// holds the secret part.
import { type Secret, reveal, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { realEngine } from "../src/server/internal/realEngine.ts";
import { simEngine } from "../src/server/internal/simEngine.ts";
import { tokensOf } from "../src/server/internal/tokensOf.ts";

const SEED = 1337;
const SecretText = s.secret(s.string());
const secretOf = (text: string): Secret<string> => {
  const r = SecretText.parse(text);
  if (!r.ok) throw new Error("not a secret");
  return r.value;
};
const engines = [() => realEngine(), () => simEngine(SEED)] as const;

const formed = fc.tuple(
  fc.constantFrom("keel", "keelsim"),
  fc.stringMatching(/^[0-9a-f]{16}$/),
  fc.stringMatching(/^[0-9a-f]{64}$/),
);

test("idOf is ok exactly when check calls find, with the id find gets", () => {
  for (const make of engines) {
    const c = tokensOf(make(), () => 0);
    const candidates = fc.oneof(
      fc.string(),
      fc.string({ unit: "binary" }),
      formed.map(([p, id, sec]) => `${p}_${id}_${sec}`),
      formed.map(([p, id, sec]) => `${p}_${id}_${sec}`.toUpperCase()),
      formed.map(([p, id, sec]) => `${p}_${id}_${sec}\n`),
    );
    fc.assert(
      fc.property(candidates, (text) => {
        const seen: string[] = [];
        const checked = c.check(secretOf(text), (id) => {
          seen.push(id);
          return undefined;
        });
        const id = c.idOf(secretOf(text));
        expect(id.ok).toBe(seen.length === 1);
        if (id.ok) expect(id.value).toBe(seen[0]);
        else expect(id).toEqual(checked);
      }),
      { seed: SEED, numRuns: 300 },
    );
  }
});

test("idOf of a well formed token returns its id and never its secret", () => {
  for (const make of engines) {
    const c = tokensOf(make(), () => 0);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), () => {
        const m = c.mint({ ttl: null });
        if (!m.ok) throw new Error("mint failed");
        const r = c.idOf(m.value.token);
        expect(r).toEqual({ ok: true, value: m.value.id });
        const secret = reveal(m.value.token).split("_")[2] ?? "";
        expect(JSON.stringify(r)).not.toContain(secret);
      }),
      { seed: SEED, numRuns: 20 },
    );
  }
});

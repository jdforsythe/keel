// @vitest-environment happy-dom
// Spec: std.sessions, clause "A `to-test` file holds no recorded `s.string()` value outside `expose`, and no `s.secret` or password value."
// Spec: std.sessions, clause "A recording is redacted once, at capture: `sessions.ingest` redacts nothing, and the server log's marks (k.privacy) never cover a filed session. `to-test` writes each `s.string()` no `expose` entry names as `x` repeated."
// Seed 1337
// Reading: a session file reaching `to-test` may hold what `sessions.ingest` filed (it redacts nothing), including keys and values under an open object that its store's schema does not declare; `to-test` holds none of them, as key or as value, nested or inside an array.
import { run } from "@keel/cli";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { MARKERS, applyTo, diskFixture, exposingModule, markedSession, sessionFile } from "./fixtures.ts";

describe("std.sessions: to-test redaction", () => {
  const fx = diskFixture();
  afterAll(() => fx.dispose());

  const emitted = async (): Promise<string> => {
    fx.write("modules/cart/module.ts", exposingModule(["store:cart.cart#note"]));
    fx.write("sessions/failing.json", sessionFile(await markedSession()));
    const sources: string[] = [];
    const apply = applyTo(fx.dir);
    const r = await run(["session", "to-test", "sessions/failing.json"], {
      cwd: fx.dir,
      files: fx.files(),
      apply: (w) => {
        for (const x of w) if (x.content !== null) sources.push(x.content);
        apply(w);
      },
    });
    expect(r.code).toBe(0);
    return sources.join("\n");
  };

  test("A `to-test` file keeps the s.string() value an `expose` entry names", async () => {
    expect(await emitted()).toContain(MARKERS.exposed);
  }, 120_000);

  test("A `to-test` file holds no recorded s.string() value outside `expose`, and no s.secret or password value", async () => {
    const text = await emitted();
    for (const [name, marker] of Object.entries(MARKERS.hidden)) {
      expect(text, name).not.toContain(marker);
    }
  }, 120_000);

  const PROFILE_SCHEMA = `import { s } from "@keel/schema";

/** The cart, with an open \`profile\` object. */
export const Cart = s.object({
  items: s.array(s.string()),
  card: s.string(),
  note: s.string(),
  pinSet: s.boolean(),
  profile: s.object({ name: s.string() }),
});
export type Cart = s.infer<typeof Cart>;
`;
  const PROFILE_STORE = `import { store } from "@keel/store";
import { Cart } from "./Cart.schema.ts";

export const cart = store(Cart, { items: [], card: "", note: "", pinSet: false, profile: { name: "" } }, { id: "cart.cart" });
`;

  test("a session file holding { profile: { name, <k>: <v> } } under an open profile gives a to-test output holding neither <k> nor <v>, nested or in an array", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{16}$/),
        fc.stringMatching(/^[a-z]{16}$/),
        fc.stringMatching(/^[a-z]{16}$/),
        async (k, v, w) => {
          const keys = [`k${k}`, `v${v}`, `n${w}`, `a${v}`, `d${k}`, `e${w}`, `rk${k}`, `rv${v}`];
          fx.write("modules/cart/Cart.schema.ts", PROFILE_SCHEMA);
          fx.write("modules/cart/cart.ts", PROFILE_STORE);
          fx.write("modules/cart/module.ts", exposingModule(["store:cart.cart#note"]));
          const base = await markedSession();
          const id = Object.keys(base.state)[0] ?? "cart.cart";
          const held = base.state[id];
          const state = {
            ...Object(held),
            profile: {
              name: "MARKNAME07",
              [keys[0] ?? ""]: keys[1],
              [keys[2] ?? ""]: { [keys[4] ?? ""]: [keys[3], keys[5]] },
            },
            [keys[6] ?? ""]: keys[7],
          };
          fx.write("sessions/failing.json", sessionFile({ ...base, state: { ...base.state, [id]: state } }));
          const sources: string[] = [];
          const apply = applyTo(fx.dir);
          const r = await run(["session", "to-test", "sessions/failing.json"], {
            cwd: fx.dir,
            files: fx.files(),
            apply: (w2) => {
              for (const x of w2) if (x.content !== null) sources.push(x.content);
              apply(w2);
            },
          });
          expect(r.code).toBe(0);
          const out = sources.join("\n");
          expect(out).toContain("profile");
          for (const m of [...keys, "MARKNAME07"]) expect(out).not.toContain(m);
        },
      ),
      { seed: 1337, numRuns: 3 },
    );
  }, 300_000);
});

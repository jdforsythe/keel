// @vitest-environment happy-dom
// std.sessions-redact, clause "Each dropped value is written as `x` repeated, found as written, URL-encoded and JSON-escaped, in any letter case; one under 3 characters only as a whole token."
// std.sessions-redact, clause "Other free text, and any other encoding of a value, is not scrubbed."
// Seed 1337 (fast-check `seed: 1337`).
// Forms asserted, as far as the sentences reach: the value (and an undeclared key's name) as written, as a substring of a longer string, in upper and lower case, URL-encoded (`encodeURIComponent`) and JSON-escaped (`JSON.stringify` without its quotes), each in an error's message, a `data` string and a thrown `Error`'s message; a value of 1 or 2 characters as a whole space-delimited token.
// Not reached by any sentence, so not asserted (missing sentences, each a form "any other encoding" or "other free text" leaves unscrubbed): a value split across two `data` strings; a number rendered in another base or with separators; a key differing only by Unicode normalization; the server log's further encodings (k.privacy: double escaping, HTML entities, hex, base64) are not claimed for a recording. "Whole token" does not say what delimits a token; a space is asserted, and that a short value inside a longer word is kept is not.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { record } from "@keel/std-sessions";
import { store } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const opts = { seed: SEED, numRuns: 10 };
const word = fc.stringMatching(/^[a-z]{16}$/);
const short = fc.stringMatching(/^[a-z]{1,2}$/);
const Pii = s.object({ p: s.object({}).pii("contact") });

type Via = "message" | "data" | "loader";
const VIAS: readonly Via[] = ["message", "data", "loader"];

let runs = 0;
async function drive(key: string, value: string, via: Via, text: string) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const rec = record(ctx);
  const c = contract("frm", { "frm.show": { path: "/frm" }, "frm.bad": { path: "/bad" } });
  let armed = false;
  const run = (): Promise<ReturnType<typeof ok<object>>> =>
    armed ? Promise.reject(new Error(text)) : Promise.resolve(ok({}));
  const built: { routes: ReturnType<typeof manifest>; st: ReturnType<typeof store<{ p: object }>> }[] = [];
  const owner = scope(
    () => {
      const st = store(Pii, { p: { [key]: value } }, { id: `frm${runs++}` });
      const page = (): Node => Box({ as: "main", id: "frm.page", children: [] });
      built.push({
        st,
        routes: manifest(c, {
          "frm.show": { component: page, loader: loader(c, "frm.show", { output: s.object({}) }, run) },
          "frm.bad": { component: page, loader: loader(c, "frm.bad", { output: s.object({}) }, run) },
        }),
      });
    },
    { detached: true },
  );
  const [b] = built;
  if (b === undefined) throw new Error("drive: build failed");
  const h = await renderRoute("frm.show", {
    routes: b.routes,
    ctx,
    params: {},
    state: [[b.st, { p: { [key]: value } }]],
  });
  if (via === "loader") {
    armed = true;
    await h.navigate(c.href("frm.bad"));
  } else {
    report(ctx, {
      kind: "error",
      error: { code: "frm.bad", message: via === "message" ? text : "bad", data: via === "data" ? { text } : null },
    });
  }
  const session = rec.stop();
  h.dispose();
  owner.dispose();
  return session;
}

/** Every string and every object key anywhere in a value. */
function texts(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) texts(x, out);
  else if (typeof v === "object" && v !== null)
    for (const [k, x] of Object.entries(v)) {
      out.push(k);
      texts(x, out);
    }
  return out;
}
const recordedText = (session: unknown): string => texts(session).join("\n").toLowerCase();

const forms: readonly { name: string; of: (v: string) => string }[] = [
  { name: "as written", of: (v) => v },
  { name: "upper case", of: (v) => v.toUpperCase() },
  { name: "URL-encoded", of: (v) => encodeURIComponent(v) },
  { name: "URL-encoded, upper case", of: (v) => encodeURIComponent(v).toUpperCase() },
  { name: "JSON-escaped", of: (v) => JSON.stringify(v).slice(1, -1) },
];
/** A value whose URL-encoding and JSON-escaping differ from it. */
const rich = fc.tuple(word, word).map(([a, b]) => `${a} "q"&/${b}`);

describe("std.sessions-redact: the forms a dropped value is found in", () => {
  for (const via of VIAS) {
    for (const f of forms) {
      for (const embed of [false, true]) {
        test(`a marked string under an undeclared key, ${f.name}${embed ? ", inside a longer string" : ""}, in ${via === "loader" ? "a loader's thrown `Error` message" : via === "data" ? "an error's `data` string" : "an error's `message`"}: not in the recording`, async () => {
          await fc.assert(
            fc.asyncProperty(word, rich, async (key, value) => {
              const shown = f.of(value);
              const text = embed ? `pre-${shown}-post` : `bad ${shown}`;
              const out = recordedText(await drive(key, value, via, text));
              expect(out).not.toContain(value.toLowerCase());
              expect(out).not.toContain(shown.toLowerCase());
              expect(out).not.toContain(encodeURIComponent(value).toLowerCase());
              expect(out).not.toContain(JSON.stringify(value).slice(1, -1).toLowerCase());
            }),
            opts,
          );
        });
      }
    }

    test(`an undeclared key's name, as written and in upper case, in ${via === "loader" ? "a loader's thrown `Error` message" : via === "data" ? "an error's `data` string" : "an error's `message`"}: not in the recording`, async () => {
      await fc.assert(
        fc.asyncProperty(word, word, async (key, value) => {
          const out = recordedText(
            await drive(`k${key}`, `v${value}`, via, `bad k${key} K${key.toUpperCase()} v${value}`),
          );
          expect(out).not.toContain(`k${key}`);
          expect(out).not.toContain(`v${value}`);
        }),
        opts,
      );
    });

    test(`a marked value under 3 characters, as a whole space-delimited token, in ${via === "loader" ? "a loader's thrown `Error` message" : via === "data" ? "an error's `data` string" : "an error's `message`"}: not a token of the recorded error`, async () => {
      await fc.assert(
        fc.asyncProperty(word, short, async (key, value) => {
          const session = await drive(key, value, via, `bad ${value} done`);
          const errors = session.events.filter((e) => e.kind === "error");
          expect(errors.length).toBeGreaterThan(0);
          for (const e of errors)
            for (const t of texts(e)) for (const tok of t.split(" ")) expect(tok.toLowerCase()).not.toBe(value);
        }),
        opts,
      );
    });
  }
});

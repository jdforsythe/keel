// @vitest-environment happy-dom
// std.sessions: no key an open object leaves undeclared, at any depth, nor anything under it, is in a recording or in
// what `to-test` writes. The path that kept one: `redact` (in strings mode, as `redactSession` calls it for a session
// file, and in the recorder's own pass) copied an object node's undeclared key as is, so a session file holding one
// (any posted to `sessions.ingest`, or recorded by another recorder) wrote it into the public test file. Seed 1337.
import { scope } from "@keel/reactive";
import { type JsonValue, s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { cartRoutes, play } from "../conformance/fixtures.ts";
import { Session } from "../src/index.ts";
import { redact } from "../src/redact.ts";
import { redactSession } from "../src/redactSession.ts";

const marker = fc.stringMatching(/^[a-z]{16}$/).map((m) => `pii${m}`);

test("redact drops every undeclared key of an object node, in strings mode and not, at any depth", () => {
  fc.assert(
    fc.property(marker, marker, fc.boolean(), (k, v, strings) => {
      const S = s.object({ m: s.object({}), r: s.record(s.object({ n: s.int() })), l: s.array(s.object({})) });
      const value: JsonValue = { m: { [k]: v }, r: { a: { n: 1, [k]: [v] } }, l: [{ [k]: { [k]: v } }], [k]: v };
      const out = redact(S, value, {
        paths: [],
        seed: 1337,
        salt: "store:s",
        ...(strings ? { strings: { except: [] } } : {}),
      });
      expect(JSON.stringify(out)).not.toContain(k);
      expect(JSON.stringify(out)).not.toContain(v);
      expect(out).toEqual({ m: {}, r: { a: { n: 1 } }, l: [{}] });
      expect(S.parse(out).ok).toBe(true);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("a session file whose store state holds an undeclared key: what to-test writes holds none of it", async () => {
  await fc.assert(
    fc.asyncProperty(marker, marker, async (k, v) => {
      const { session } = await play(1337, [{ nav: true }]);
      // A store of an open object, live as `to-test` sees it; the session file carries an undeclared key under it.
      const dispose = scope(() => {
        store(
          s.object({ profile: s.object({ name: s.string() }) }),
          { profile: { name: "n" } },
          { id: "leak.profile" },
        );
      }).dispose;
      try {
        const filed: Session = {
          ...session,
          state: { ...session.state, "leak.profile": { profile: { name: "n", [k]: v } } },
        };
        const text = JSON.stringify(Session.encode(redactSession(filed, { routes: cartRoutes(), expose: [] })));
        expect(text).not.toContain(k);
        expect(text).not.toContain(v);
      } finally {
        dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

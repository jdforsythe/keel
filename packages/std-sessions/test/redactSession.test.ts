// @vitest-environment happy-dom
// `redactSession` (std.sessions D3, what `to-test` writes): strings outside `expose` become `x` repeated, and the
// rewritten session still replays to the same fingerprint. Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { cartRoutes, play } from "../conformance/fixtures.ts";
import { Session } from "../src/index.ts";
import { redactSession } from "../src/redactSession.ts";
import { replay } from "../src/replay.ts";

test("no recorded string outside `expose` survives; exposed ones do; the result parses and reproduces", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[A-Z]{10,16}$/), async (marker) => {
      const { session } = await play(1337, [{ id: "cart.card", value: marker }, { id: "cart.add" }, { nav: true }]);
      const hidden = redactSession(session, { routes: cartRoutes(), expose: [] });
      const text = JSON.stringify(Session.encode(hidden));
      expect(text).not.toContain(marker);
      expect(Session.parse(JSON.parse(text)).ok).toBe(true);
      expect((await replay(hidden, { routes: cartRoutes() })).reproduced).toBe(true);
      const shown = redactSession(session, {
        routes: cartRoutes(),
        expose: ["el:cart.card#value", "tx:cart.pay#card.number"],
      });
      expect(JSON.stringify(Session.encode(shown))).toContain(marker);
    }),
    { seed: 1337, numRuns: 10 },
  );
});

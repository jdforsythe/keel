// Spec: k.supervise, clause "A std.live `read` that calls `defect('bug')` or throws the string `'s'` on its first run and returns `ok` on its second: `status()` is `connecting` after the first, a second read runs 1 s later on `ctx.clock`, and `status()` is then `live`."
// Seed 1337 (no random input: the two throws are fixed). Sim clock.
import { defect, ok } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { type Read, EMPTY, createServer, mount, settle, simCtx, tick } from "./fixtures.ts";

const THROWS: readonly (readonly [string, () => never])[] = [
  ["calls `defect('bug')`", () => defect("bug")],
  [
    "throws the string `'s'`",
    () => {
      throw "s";
    },
  ],
];

describe("k.supervise: a std.live `read` that throws takes the failed-read path", () => {
  for (const [name, boom] of THROWS) {
    test(`a \`read\` that ${name} on its first run and returns \`ok\` on its second: \`status()\` is \`connecting\` after the first, a second read runs 1 s later on \`ctx.clock\`, and \`status()\` is then \`live\``, async () => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      const at: number[] = [];
      const read: Read = async (c) => {
        at.push(c.clock.now());
        return at.length === 1 ? boom() : ok(EMPTY);
      };
      const m = mount(ctx, read);
      await settle();
      expect(at).toEqual([0]);
      expect(m.status()).toBe("connecting");
      expect(m.view.log()).toHaveLength(0);
      await tick(ctx, 999);
      expect(at).toHaveLength(1);
      await tick(ctx, 1);
      expect(at).toEqual([0, 1000]);
      expect(m.status()).toBe("live");
      m.dispose();
    });
  }
});

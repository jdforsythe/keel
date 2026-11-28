// Spec: k.supervise, clause "A std.channels route whose `member` calls `defect('bug')` or throws the string `'s'`: a stream opened on it gets `{ kind: 'closed', reason: 'denied' }` as its only event and ends within 1,000 ms on `ctx.clock`, and a publish answers 403."
// Seed 1337 (no random input: the two throws are fixed). Sim clock: "within 1,000 ms" is the clock advanced by 1,000, then the turns settled.
import { defect } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { roomChannel, serve, settle, waitFor } from "./fixtures.ts";

const THROWS: readonly (readonly [string, () => boolean])[] = [
  ["calls `defect('bug')`", () => defect("bug")],
  [
    "throws the string `'s'`",
    () => {
      throw "s";
    },
  ],
];

describe("k.supervise: a std.channels route whose `member` throws denies", () => {
  for (const [name, member] of THROWS) {
    test(`a route whose \`member\` ${name}: a stream opened on it gets \`{ kind: 'closed', reason: 'denied' }\` as its only event and ends within 1,000 ms on \`ctx.clock\``, async () => {
      const h = await serve({ member });
      try {
        const cookie = await h.mint();
        const stream = await h.open("r", cookie);
        h.ctx.clock.advance(1000);
        await settle();
        await waitFor(() => stream.ended());
        expect(stream.events).toEqual([{ kind: "closed", reason: "denied" }]);
        stream.close();
      } finally {
        await h.dispose();
      }
    });

    test(`a route whose \`member\` ${name}: a publish answers 403`, async () => {
      const h = await serve({ member });
      try {
        const cookie = await h.mint();
        const res = await h.post(roomChannel.path, { message: { text: "hi" } }, { cookie, search: "?room=r" });
        expect(res.status).toBe(403);
      } finally {
        await h.dispose();
      }
    });
  }
});

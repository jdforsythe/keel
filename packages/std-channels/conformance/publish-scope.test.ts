// Spec: std.channels, clause "A member's publish delivers `{ kind: 'message', message }` to every open member stream of the same channel and params, the publisher's included, and to none with other params; a non-member's publish is 403 and delivers nothing."
// Seed 1337
// Also: `publish(ctx, origin, channel, params, message)` returns `Promise<Result<null, ApiError>>` (Client).
import { ok } from "@keel/schema";
import { publish } from "@keel/std-channels";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, roomChannel, serve, settle, simCtx, waitFor } from "./fixtures.ts";

const CLAUSE =
  "A member's publish delivers `{ kind: 'message', message }` to every open member stream of the same channel and params, the publisher's included, and to none with other params; a non-member's publish is 403 and delivers nothing.";

const text = fc.string({ maxLength: 12 });

test(`${CLAUSE} (a member's POST reaches the same params, the publisher's stream included, and answers ok(null))`, async () => {
  await fc.assert(
    fc.asyncProperty(text, async (t) => {
      const h = await serve();
      try {
        const a = await h.enroll();
        const a2 = await h.enroll();
        const c = await h.enroll();
        const sa = await h.open("a", a);
        const sa2 = await h.open("a", a2);
        const sc = await h.open("b", c);
        await waitFor(() => [sa, sa2, sc].every((st) => st.events.length >= 1));
        const before = sc.events.length;
        const res = await h.post(roomChannel.path, { message: { text: t } }, { cookie: a, search: "?room=a" });
        expect(res.status).toBe(200);
        const body: unknown = await res.json();
        expect(body).toMatchObject({ ok: true, value: {} });
        const want = { kind: "message", message: { text: t } };
        await waitFor(() => [sa, sa2].every((st) => st.events.some((e) => JSON.stringify(e) === JSON.stringify(want))));
        await settle();
        expect(sc.events).toHaveLength(before);
        for (const st of [sa, sa2, sc]) st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test(`${CLAUSE} (a non-member's POST is 403 and no stream gets an event)`, async () => {
  await fc.assert(
    fc.asyncProperty(text, async (t) => {
      const h = await serve();
      try {
        const a = await h.enroll();
        const stranger = await h.mint();
        const sa = await h.open("a", a);
        await waitFor(() => sa.events.length >= 1);
        const before = sa.events.length;
        const res = await h.post(roomChannel.path, { message: { text: t } }, { cookie: stranger, search: "?room=a" });
        expect(res.status).toBe(403);
        await settle();
        expect(sa.events).toHaveLength(before);
        sa.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test(`${CLAUSE} (\`publish\` from a client ctx is ok(null) for a member and an api.status 403 err for a non-member)`, async () => {
  await fc.assert(
    fc.asyncProperty(text, fc.boolean(), async (t, member) => {
      const h = await serve({ member: () => member });
      try {
        const sa = await h.open("a", member ? await h.mint() : undefined);
        await waitFor(() => sa.events.length >= 1 || sa.ended());
        const client = simCtx();
        client.net.route(`${ORIGIN}/*`, (req) => h.app.fetch(req));
        const before = sa.events.length;
        const r = await publish(client, ORIGIN, roomChannel, { room: "a" }, { text: t });
        if (member) {
          expect(r).toEqual(ok(null));
          await waitFor(() => sa.events.length > before);
          expect(sa.events.at(-1)).toEqual({ kind: "message", message: { text: t } });
        } else {
          expect(r.ok).toBe(false);
          expect(JSON.stringify(r)).toContain("api.status");
          expect(JSON.stringify(r)).toContain("403");
          await settle();
          expect(sa.events).toHaveLength(before);
        }
        sa.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

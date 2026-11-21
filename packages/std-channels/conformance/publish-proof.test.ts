// Spec: std.channels, clause "A publish without same-site proof is 403 `keel.denied` and one failing `message` is 422 `keel.fields`; neither delivers anything."
// Seed 1337
// Assumption: a request with `sec-fetch-site: cross-site`, a foreign `origin` and no `x-keel` header lacks the k.server same-site proof.
import fc from "fast-check";
import { expect, test } from "vitest";
import { roomChannel, serve, settle, waitFor } from "./fixtures.ts";

const CLAUSE =
  "A publish without same-site proof is 403 `keel.denied` and one failing `message` is 422 `keel.fields`; neither delivers anything.";

const POST_HEADERS = { "sec-fetch-site": "cross-site", origin: "https://evil.test", "x-keel": "" };

test(`${CLAUSE} (without same-site proof: 403 keel.denied)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 12 }), async (t) => {
      const h = await serve();
      try {
        const a = await h.enroll();
        const st = await h.open("a", a);
        await waitFor(() => st.events.length >= 1);
        const before = st.events.length;
        const res = await h.post(
          roomChannel.path,
          { message: { text: t } },
          { cookie: a, search: "?room=a", headers: POST_HEADERS },
        );
        expect(res.status).toBe(403);
        expect(await res.text()).toContain("keel.denied");
        await settle();
        expect(st.events).toHaveLength(before);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test(`${CLAUSE} (a \`message\` failing the schema: 422 keel.fields)`, async () => {
  const bad = fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant({}), fc.constant({ text: 7 }));
  await fc.assert(
    fc.asyncProperty(bad, fc.boolean(), async (message, omit) => {
      const h = await serve();
      try {
        const a = await h.enroll();
        const st = await h.open("a", a);
        await waitFor(() => st.events.length >= 1);
        const before = st.events.length;
        const res = await h.post(roomChannel.path, omit ? {} : { message }, { cookie: a, search: "?room=a" });
        expect(res.status).toBe(422);
        expect(await res.text()).toContain("keel.fields");
        await settle();
        expect(st.events).toHaveLength(before);
        st.close();
      } finally {
        await h.dispose();
      }
    }),
    { seed: 1337, numRuns: 10 },
  );
});

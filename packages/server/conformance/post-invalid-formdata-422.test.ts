// Clause: A POST with invalid FormData returns 422, does not call the action, and lists the field errors.
// Also covers k.forms: with the runtime absent, posting invalid FormData returns 422 HTML with submitted values and messages.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build, kinds, post } from "./fixtures.ts";

const word = fc.array(fc.constantFrom(..."abcdefghjkmnpqrstuvwxyz"), { minLength: 6, maxLength: 12 }).map((a) => a.join(""));

describe("k.server", () => {
  it("A POST with invalid FormData returns 422, does not call the action, and lists the field errors", async () => {
    const { app, n } = await build({});
    await fc.assert(
      fc.asyncProperty(
        word.filter((w) => !kinds.some((k) => k === w)),
        word,
        async (badKind, note) => {
          const res = await app.fetch(post("/orders/open", { kind: badKind, note }, { accept: "application/json" }));
          expect(res.status).toBe(422);
          const json: unknown = await res.json();
          const text = JSON.stringify(json);
          expect(text).toContain("keel.fields");
          expect(text).toContain("kind");
          expect(n.act).toBe(0);
        },
      ),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("With the runtime absent, posting invalid FormData returns 422 HTML containing the submitted values and messages", async () => {
    const { app, n } = await build({});
    await fc.assert(
      fc.asyncProperty(
        word.filter((w) => !kinds.some((k) => k === w)),
        word,
        async (badKind, note) => {
          const res = await app.fetch(post("/orders/open", { kind: badKind, note }));
          expect(res.status).toBe(422);
          expect(res.headers.get("content-type") ?? "").toContain("text/html");
          const body = await res.text();
          expect(body).toContain(badKind);
          expect(body).toContain(note);
          expect(body).toContain("kind");
          expect(n.act).toBe(0);
        },
      ),
      { seed: 1337, numRuns: 30 },
    );
  });
});

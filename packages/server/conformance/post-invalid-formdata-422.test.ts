// @vitest-environment happy-dom
// Clause: A POST with invalid FormData returns 422, does not call the action, and lists the field errors.
// Also covers k.forms: with the runtime absent, posting invalid FormData returns 422 HTML with submitted values and messages.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build, kinds, post } from "./fixtures.ts";

const word = fc
  .array(fc.constantFrom(..."abcdefghjkmnpqrstuvwxyz"), { minLength: 6, maxLength: 12 })
  .map((a) => a.join(""));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

describe("k.server", () => {
  it("A POST with invalid FormData returns 422, does not call the action, and lists the field errors", async () => {
    const { app, n } = await build({});
    await fc.assert(
      fc.asyncProperty(
        word.filter((w) => !kinds.some((k) => k === w)),
        word,
        async (badKind, note) => {
          const res = await app.fetch(
            post("/orders/open", { kind: badKind, note }, { accept: "application/json", "x-keel": "1" }),
          );
          expect(res.status).toBe(422);
          const json: unknown = await res.json();
          expect(isRecord(json) && json["ok"]).toBe(false);
          const error = isRecord(json) ? json["error"] : undefined;
          expect(isRecord(error) && error["code"]).toBe("keel.fields");
          const data = isRecord(error) ? error["data"] : undefined;
          expect(isRecord(data)).toBe(true);
          if (!isRecord(data)) return;
          const msg = data["kind"];
          expect(typeof msg).toBe("string");
          expect(typeof msg === "string" && msg.length > 0).toBe(true);
          expect(Object.hasOwn(data, "note")).toBe(false);
          expect(Object.keys(data)).toEqual(["kind"]);
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

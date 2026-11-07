import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
// @vitest-environment happy-dom
// Spec: k.server, clause "A POST with invalid FormData or JSON (empty JSON too) returns 422, does not call the action, and lists the field errors."
// Spec: k.forms, clause "With the runtime absent, posting invalid FormData returns 422 HTML containing the submitted values and messages."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE, build, createApp, kinds, post } from "./fixtures.ts";

const jsonHeaders = { "content-type": "application/json", accept: "application/json", "x-keel": "1" };
const postJson = (path: string, body: string) =>
  new Request(`${BASE}${path}`, { method: "POST", body, headers: jsonHeaders });

const word = fc
  .array(fc.constantFrom(..."abcdefghjkmnpqrstuvwxyz"), { minLength: 6, maxLength: 12 })
  .map((a) => a.join(""));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

describe("k.server", () => {
  it("A POST with invalid FormData or JSON (empty JSON too) returns 422, does not call the action, and lists the field errors", async () => {
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

  it("A POST with a JSON body that fails the action input returns 422 keel.fields naming the field and does not call the action", async () => {
    const { app, n } = await build({});
    await fc.assert(
      fc.asyncProperty(
        word.filter((w) => !kinds.some((k) => k === w)),
        word,
        async (badKind, note) => {
          const res = await app.fetch(postJson("/orders/open", JSON.stringify({ kind: badKind, note })));
          expect(res.status).toBe(422);
          const json: unknown = await res.json();
          const error = isRecord(json) ? json["error"] : undefined;
          expect(isRecord(error) && error["code"]).toBe("keel.fields");
          const data = isRecord(error) ? error["data"] : undefined;
          expect(isRecord(data) && Object.keys(data)).toEqual(["kind"]);
          expect(n.act).toBe(0);
        },
      ),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("A POST with an empty JSON body to an action with required fields returns 422 keel.fields with a key per required field and does not call the action", async () => {
    const { app, n } = await build({});
    const res = await app.fetch(postJson("/orders/open", ""));
    expect(res.status).toBe(422);
    const json: unknown = await res.json();
    const error = isRecord(json) ? json["error"] : undefined;
    expect(isRecord(error) && error["code"]).toBe("keel.fields");
    const data = isRecord(error) ? error["data"] : undefined;
    expect(isRecord(data)).toBe(true);
    if (!isRecord(data)) return;
    expect(Object.keys(data).sort()).toEqual(["kind", "note"]);
    expect(Object.hasOwn(data, "")).toBe(false);
    expect(n.act).toBe(0);
  });

  it("A POST with an empty JSON body to an action whose input accepts {} runs the action", async () => {
    let calls = 0;
    const act = action({ input: s.object({ note: s.string().optional() }) }, () => {
      calls++;
      return Promise.resolve(ok(null));
    });
    const routes = manifest({
      "tick.show": { path: "/tick", component: () => document.createElement("main") },
    });
    routes.actions({ "tick.show": { POST: act } });
    const app = await createApp({
      topology: topology({ web: { modules: ["tick"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "production",
    });
    const res = await app.fetch(postJson("/tick", ""));
    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(isRecord(json) && json["ok"]).toBe(true);
    expect(calls).toBe(1);
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

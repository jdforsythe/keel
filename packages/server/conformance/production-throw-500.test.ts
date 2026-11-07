// @vitest-environment happy-dom
// Spec: k.server, clause "An uncaught throw in production mode yields 500 whose body contains neither the thrown message nor a stack frame."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build, get, post } from "./fixtures.ts";

const msg = fc.array(fc.constantFrom(..."qxzjkwvy"), { minLength: 12, maxLength: 20 }).map((a) => a.join(""));
const frame = /\bat\s+\S+.*\(|\.tsx?:\d+|\.m?js:\d+|node_modules/;

describe("k.server", () => {
  it("An uncaught throw in a loader in production mode yields 500 with neither the thrown message nor a stack frame", async () => {
    await fc.assert(
      fc.asyncProperty(msg, async (m) => {
        const { app } = await build({ show: () => Promise.reject(new Error(m)) }, "production");
        const res = await app.fetch(get("/orders/open"));
        expect(res.status).toBe(500);
        const body = await res.text();
        expect(body).not.toContain(m);
        expect(body).not.toMatch(frame);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("An uncaught throw in an action in production mode yields 500 with neither the thrown message nor a stack frame", async () => {
    await fc.assert(
      fc.asyncProperty(msg, async (m) => {
        const { app } = await build({ act: () => Promise.reject(new Error(m)) }, "production");
        const res = await app.fetch(post("/orders/open", { kind: "open", note: "n" }, { accept: "application/json" }));
        expect(res.status).toBe(500);
        const body = await res.text();
        expect(body).not.toContain(m);
        expect(body).not.toMatch(frame);
        expect(body).toContain("keel.unexpected");
        expect(body).toContain("unexpected");
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});

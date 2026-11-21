// `identify`'s throw is logged by its error's `name` only, and only a plain identifier counts as one (k.user).
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, identity, topology } from "../src/index.ts";

const c = contract("app", { "app.x": { method: "GET", path: "/x", output: s.object({}) } });

async function logged(thrown: () => unknown): Promise<{ status: number; lines: string[] }> {
  const lines: string[] = [];
  const read = loader(c, "app.x", {}, async () => ok({}));
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, { "app.x": { loader: read } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    log: { format: "json", write: (l) => void lines.push(l) },
    identity: identity({
      identify: async () => {
        throw thrown();
      },
    }),
  });
  const res = await app.fetch(new Request("http://localhost/x", { headers: { accept: "application/json" } }));
  return { status: res.status, lines };
}

describe("identify threw", () => {
  it("names `Error` for a thrown value that is not an error, a name that is not an identifier, or a name getter that throws", async () => {
    const getter = Object.defineProperty({}, "name", {
      get: () => {
        throw new Error("t-1");
      },
    });
    for (const thrown of ["t-2 secret", { name: "has space t-3" }, getter]) {
      const r = await logged(() => thrown);
      expect(r.status).toBe(500);
      const text = r.lines.join("\n");
      expect(text).toContain("identify threw: Error");
      expect(text).not.toMatch(/t-[123]/);
    }
  });

  it("names an identifier name as given", async () => {
    const r = await logged(() => Object.assign(new Error("t-4"), { name: "SessionLookupError" }));
    expect(r.lines.join("\n")).toContain("identify threw: SessionLookupError");
    expect(r.lines.join("\n")).not.toContain("t-4");
  });
});

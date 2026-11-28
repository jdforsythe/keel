// @vitest-environment node
// Examples (k.privacy Server log, k.server Log, E1554): a live loader's throw is a scrubbed `diag` and a last `err`
// line, never console output; an E1554 diag shows a record key as `*`; a guard's throw is scrubbed and logged. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type RouteTable, action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, reveal, s } from "@keel/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { textRecords } from "./textRecords.ts";

const SEED = 1337;
const TOKEN = "zzTOKENzz1234567890";
const Nothing = s.object({});
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

async function boot(routes: RouteTable, mode: "dev" | "production") {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  // With full text on (dev), the text records; in production, each throw's one form record (k.serverlog Thrown values).
  const diags = (): string[] =>
    (mode === "dev" ? textRecords(lines) : lines).filter((l) => field(JSON.parse(l), "kind") === "diag");
  return { app, lines, diags };
}
const get = (path: string, accept: string): Request =>
  new Request(`http://localhost${path}`, { headers: { accept, authorization: `Bearer ${TOKEN}` } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("red team 0104", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`a live loader throwing the revealed bearer writes one diag, [secret] where it holds text, and an err line, nothing to the console (${mode})`, async () => {
      const printed: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void printed.push(a.map(String).join(" ")));
      const c = contract("api", {
        "api.live": { method: "GET", path: "/api/live", output: Nothing, events: true },
      });
      const live = loader(c, "api.live", {}, async function* ({ bearer }) {
        yield ok({});
        if (bearer !== undefined) throw new Error(`live boom ${reveal(bearer)}`);
      });
      const routes = manifest(c, { "api.live": { loader: live } });
      const t = await boot(routes, mode);
      const res = await t.app.fetch(get("/api/live", "text/event-stream"));
      const body = await res.text();
      const data = body
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l): unknown => JSON.parse(l.slice(6)));
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ ok: true, value: {} });
      expect(field(data[1], "ok")).toBe(false);
      expect(field(field(data[1], "error"), "code")).toBe("keel.unexpected");
      expect(body).not.toContain(TOKEN);
      expect(printed).toEqual([]);
      const diags = t.diags();
      expect(diags).toHaveLength(1);
      if (mode === "dev") expect(diags[0]).toContain("[secret]");
      else
        expect(field(JSON.parse(diags[0] ?? "{}"), "message")).toMatch(/^loader api\.live threw: Error #[0-9a-f]{8}/);
      expect(diags[0]).toContain("loader api.live threw");
      for (const l of t.lines) expect(l).not.toContain(TOKEN);
    });
  }

  it("an action's E1554 diag shows a record key as *, an object field and an array index as they are", async () => {
    const Out = s.object({ byMail: s.record(s.int({ max: 1 })), list: s.array(s.object({ n: s.int({ max: 1 }) })) });
    const c = contract("api", {
      "api.rec": { method: "POST", path: "/api/rec", body: Nothing, output: Out },
      "api.recPut": { method: "PUT", path: "/api/rec", body: Nothing, output: Out },
    });
    const rec = action(c, "api.rec", {}, async () => ok({ byMail: { "alice@example.com": 5 }, list: [] }));
    const arr = action(c, "api.recPut", {}, async () => ok({ byMail: {}, list: [{ n: 0 }, { n: 7 }] }));
    const routes = manifest(c, { "api.rec": { action: rec }, "api.recPut": { action: arr } });
    const t = await boot(routes, "dev");
    const send = (method: string) =>
      t.app.fetch(
        new Request("http://localhost/api/rec", {
          method,
          body: "{}",
          headers: { "content-type": "application/json", accept: "application/json", "x-keel": "1" },
        }),
      );
    const a = await send("POST");
    expect(a.status).toBe(500);
    expect(await a.text()).not.toContain("alice@example.com");
    const b = await send("PUT");
    expect(b.status).toBe(500);
    const diags = t.diags();
    expect(diags).toHaveLength(2);
    expect(diags[0]).toContain("action api.rec data fails its output schema at byMail.*");
    expect(diags[1]).toContain("action api.recPut data fails its output schema at list.1.n");
    for (const l of t.lines) expect(l).not.toContain("alice@example.com");
  });

  it("a loader's E1554 diag shows a record key as *", async () => {
    const c = contract("api", {
      "api.read": {
        method: "GET",
        path: "/api/read",
        output: s.record(s.object({ n: s.int({ max: 1 }) })),
      },
    });
    const read = loader(c, "api.read", {}, async () => ok({ "bob@example.com": { n: 9 } }));
    const routes = manifest(c, { "api.read": { loader: read } });
    const t = await boot(routes, "dev");
    const res = await t.app.fetch(
      new Request("http://localhost/api/read", { headers: { accept: "application/json" } }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("bob@example.com");
    const diags = t.diags();
    expect(diags).toHaveLength(1);
    expect(diags[0]).toContain("loader api.read data fails its output schema at *.n");
    for (const l of t.lines) expect(l).not.toContain("bob@example.com");
  });

  for (const mode of ["dev", "production"] as const) {
    it(`a guard throwing the revealed bearer answers 500 without it and logs one diag, [secret] where it holds text (${mode})`, async () => {
      const g = guard({}, async ({ bearer }) => {
        if (bearer !== undefined) throw new Error(`guard boom ${reveal(bearer)}`);
        return ok(null);
      });
      const c = contract("api", { "api.g": { method: "GET", path: "/api/g", output: Nothing } });
      const read = loader(c, "api.g", {}, async () => ok({}));
      const routes = manifest(c, { "api.g": { guard: g, loader: read } });
      const t = await boot(routes, mode);
      const res = await t.app.fetch(get("/api/g", "application/json"));
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).not.toContain(TOKEN);
      expect(body).toContain("keel.unexpected");
      if (mode === "dev") expect(body).toContain("[secret]");
      const diags = t.diags();
      expect(diags).toHaveLength(1);
      expect(diags[0]).toContain("guard api.g threw");
      if (mode === "dev") expect(diags[0]).toContain("[secret]");
      else expect(field(JSON.parse(diags[0] ?? "{}"), "message")).toMatch(/^guard api\.g threw: Error #[0-9a-f]{8}/);
      for (const l of t.lines) expect(l).not.toContain(TOKEN);
    });
  }
});

// @vitest-environment node
// Backlog 0224 (file names never from a client id) and 0228 (no token over plain http to a remote host). Seed 1337
import path from "node:path";
import type { Io } from "@keel/cli";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "../src/Session.schema.ts";
import { command } from "../src/command.ts";
import { fileOf } from "../src/internal/fileOf.ts";
import { routes } from "../src/routes.ts";

const error = { code: "app.boom", message: "boom", data: null };
const raw = (id: string) => ({
  v: 1,
  id,
  deterministic: true,
  at: 1,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [{ at: 1, kind: "error", route: "cart.show", error }],
  error,
  fingerprint: "abcdefabcdef",
});
const made = (id: string, fingerprint = "abcdefabcdef"): Session => {
  const r = Session.parse({ ...raw(id), fingerprint });
  if (!r.ok) throw new Error(`fixture ${id}`);
  return r.value;
};
const REPRO = "/../../../package";

describe("0224 session file names", () => {
  test("the repro id is rejected by the schema and by the ingest route with 422", async () => {
    expect(Session.parse(raw(REPRO)).ok).toBe(false);
    expect(Session.parse(raw("a".repeat(65))).ok).toBe(false);
    expect(Session.parse(raw("ok_id-1")).ok).toBe(true);
    const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
    const app = await createApp({
      topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
      routes,
      ctx,
      mode: "production",
    });
    const res = await app.fetch(
      new Request("http://localhost/sessions", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(raw(REPRO)),
      }),
    );
    expect(res.status).toBe(422);
  });

  test("file naming ignores the id: fingerprint (12 hex) and a counter", () => {
    expect(fileOf(made("x"), 3)).toBe(".keel/sessions/abcdefabcdef-3.json");
    expect(fileOf(made("x", "../../etc/x"), 0)).toBe(".keel/sessions/000000000000-0.json");
  });

  test("property: no written path leaves .keel/sessions/", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.nat(50), (id, fp, i) => {
        const posted = Session.parse({ ...raw(id), fingerprint: fp });
        const x = posted.ok ? posted.value : { ...made("fixed"), fingerprint: fp };
        const rel = path.posix.relative(".keel/sessions", path.posix.normalize(fileOf(x, i)));
        return !rel.startsWith("..") && !rel.includes("/") && !path.isAbsolute(rel);
      }),
      { seed: 1337, numRuns: 300 },
    );
  });
});

describe("0228 ingest URL", () => {
  const listed = { results: { "sessions.list": { ok: true, value: {} } } };
  async function run(target: string) {
    const seen: { url: string; cookie: string | undefined }[] = [];
    const io: Io = {
      cwd: "/",
      env: { KEEL_SESSIONS_TOKEN: "tok" },
      fetch: async (url, init) => {
        seen.push({ url: String(url), cookie: new Headers(init?.headers).get("cookie") ?? undefined });
        return new Response(JSON.stringify(listed), { status: 200 });
      },
    };
    const out = await command.run({ op: "ingest", target }, io);
    return { seen, out };
  }
  const code = (o: Awaited<ReturnType<typeof run>>["out"]) =>
    o.records.flatMap((r) => (r.kind === "diag" ? [String(r.code)] : []));

  test.each(["https://sessions.example.com", "http://localhost:4200", "http://127.0.0.1:4200", "http://[::1]:4200"])(
    "%s is allowed",
    async (url) => {
      const { seen, out } = await run(url);
      expect(code(out)).toEqual([]);
      expect(seen[0]?.cookie).toContain("tok");
    },
  );
  test.each(["http://sessions.example.com", "http://localhost.evil.com", "ftp://localhost", "not a url"])(
    "%s is refused with E1056 and sends nothing",
    async (url) => {
      const { seen, out } = await run(url);
      expect(code(out)).toEqual(["E1056"]);
      expect(seen).toEqual([]);
    },
  );
});

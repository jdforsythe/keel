// Spec: k.supervise, clause "In production mode on a node server, a runner calling `supervise(ctx, 'm.run', () => defect('user failed', 'E2801', { data: { email: 'jane@x.com' } }), T)` logs one `diag` whose code is `keel.unexpected` and whose message matches `^supervised m\.run threw: Defect E2801 #[0-9a-f]{8}( at \S+:\d+)?$`; no logged line holds `jane`; the process writes no E1577 and keeps serving; with `mode: 'dev'` a second `diag` follows whose message starts `supervised m.run threw: Defect: E2801 user failed`."
// @vitest-environment happy-dom
// Seed 1337 (fixed throw; no random input). The runner receives the app's ctx; `supervise` is the library call, made here from a test file standing in for a library's runner.
import { createCtx, supervise } from "@keel/ctx";
import { defect, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { SEED, get } from "./fixtures.ts";
import { createAppLoose, flush, pageManifest } from "./topology-fixtures.ts";

const T = s.error("m.thrown", s.object({})).make({});
type Rec = { kind: string; code: string; message: string };
const records = (lines: readonly string[]): Rec[] =>
  lines.flatMap((l) => {
    const v: unknown = JSON.parse(l);
    if (typeof v !== "object" || v === null) return [];
    const kind = Reflect.get(v, "kind");
    const code = Reflect.get(v, "code");
    const message = Reflect.get(v, "message");
    return typeof kind === "string" && typeof message === "string" ? [{ kind, code: String(code), message }] : [];
  });

async function boot(mode: "dev" | "production") {
  const lines: string[] = [];
  const outcome: { failed: boolean | undefined } = { failed: undefined };
  const run = async (ctx: ReturnType<typeof createCtx>, signal: AbortSignal): Promise<void> => {
    const r = await supervise(ctx, "m.run", () => defect("user failed", "E2801", { data: { email: "jane@x.com" } }), T);
    outcome.failed = !r.ok;
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
  };
  const app = await createAppLoose({
    topology: topology({ x: { modules: ["a"], adapter: "node" } }),
    routes: pageManifest("a", "/a", "A"),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
    runners: { a: [{ run }] },
  });
  await flush();
  return { app, lines, outcome };
}
const SUPERVISED = /^supervised m\.run threw: Defect E2801 #[0-9a-f]{8}( at \S+:\d+)?$/;

describe("k.supervise Report: a supervised throw on a server", () => {
  it("in production mode, `supervise(ctx, 'm.run', () => defect('user failed', 'E2801', { data: { email: 'jane@x.com' } }), T)` logs one `diag` with code `keel.unexpected` whose message matches the stated form", async () => {
    const { app, lines, outcome } = await boot("production");
    const diags = records(lines).filter((r) => r.kind === "diag" && r.message.startsWith("supervised m.run threw"));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe("keel.unexpected");
    expect(diags[0]?.message).toMatch(SUPERVISED);
    expect(outcome.failed).toBe(true);
    await app.close?.();
  });

  it("no logged line holds `jane`, the process writes no E1577 and keeps serving", async () => {
    const { app, lines } = await boot("production");
    for (const l of lines) expect(l).not.toContain("jane");
    expect(records(lines).some((r) => r.code === "E1577")).toBe(false);
    const res = await app.fetch(get("/a", { accept: "text/html" }));
    expect(res.status).toBe(200);
    await app.close?.();
  });

  it("with `mode: 'dev'` a second `diag` follows whose message starts `supervised m.run threw: Defect: E2801 user failed`", async () => {
    const { app, lines } = await boot("dev");
    const diags = records(lines).filter((r) => r.kind === "diag" && r.message.startsWith("supervised m.run threw"));
    expect(diags).toHaveLength(2);
    expect(diags[0]?.message).toMatch(SUPERVISED);
    expect(diags[1]?.message.startsWith("supervised m.run threw: Defect: E2801 user failed")).toBe(true);
    await app.close?.();
  });
});

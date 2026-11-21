// RFC 0057 amendment (backlog 0159): `createApp({ secret })` under 32 bytes (UTF-8) rejects with E1556 at startup, since
// an empty or short HMAC key lets anyone sign caller cookies; a deployed production start (the E1555 gate) without a
// secret writes one W1556 diag to `log`, because each instance then signs with its own random key.
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { callerSigner } from "../src/internal/callerSigner.ts";

const home = contract("app", { "app.home": { path: "/" } });
const made: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const built = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-secret-"));
  made.push(d);
  fs.mkdirSync(path.join(d, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(d, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(d, ".vite/manifest.json"),
    JSON.stringify({ e: { file: "assets/entry-Ab12Cd34.js", isEntry: true } }),
  );
  fs.writeFileSync(path.join(d, "assets/entry-Ab12Cd34.js"), "resume()");
  return d;
};
const app = (o: {
  secret?: string;
  mode?: "dev" | "production";
  assets?: string;
  lines?: string[];
  secure?: boolean;
  origin?: string;
}) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(home, {
      "app.home": {
        component: () => document.createElement("p"),
        POST: action(home, "app.home", { input: s.object({}) }, async () => ok(null)),
      },
    }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...(o.secret === undefined ? {} : { secret: o.secret }),
    ...(o.secure === undefined ? {} : { secure: o.secure }),
    ...(o.origin === undefined ? {} : { origin: o.origin }),
    ...(o.mode === undefined ? {} : { mode: o.mode }),
    ...(o.assets === undefined ? {} : { assets: o.assets }),
    ...(o.lines === undefined ? {} : { log: { format: "json", write: (l: string) => o.lines?.push(l) } }),
  });

describe("createApp({ secret }) (backlog 0159)", () => {
  it("backlog 0159 repro: an empty key signs cookies anyone can forge, so createApp refuses it", async () => {
    const t = "A".repeat(22);
    expect((await callerSigner("")).valid(`${t}.${createHmac("sha256", "").update(t).digest("base64url")}`)).toBe(true);
    await expect(app({ secret: "" })).rejects.toMatchObject({
      code: "E1556",
      message: expect.stringMatching(/^E1556 secret: /),
    });
  });

  it.each([
    ["a", false],
    ["x".repeat(31), false],
    ["é".repeat(15), false],
    ["x".repeat(32), true],
    ["é".repeat(16), true],
  ])("a %j secret (UTF-8 bytes against 32) is accepted: %s", async (secret, ok) => {
    if (ok) await expect(app({ secret })).resolves.toBeDefined();
    else await expect(app({ secret })).rejects.toMatchObject({ code: "E1556" });
  });

  it("a deployed production start without a secret writes one W1556 diag; with one, or in dev or test, none", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const lines: string[] = [];
    await app({ assets: built(), lines, secure: true });
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      { kind: "diag", code: "W1556", message: expect.stringContaining("callers reset"), see: "k.server" },
    ]);
    const quiet: string[] = [];
    await app({ assets: built(), lines: quiet, secret: "s".repeat(32), secure: true });
    await app({ assets: built(), lines: quiet, mode: "dev" });
    vi.stubEnv("NODE_ENV", "test");
    await app({ lines: quiet });
    expect(quiet).toEqual([]);
  });

  it("backlog 0160: a deployed production start without `secure` writes one W1557 diag; with it, or in dev or test, none", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const lines: string[] = [];
    await app({ assets: built(), lines, secret: "s".repeat(32) });
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      {
        kind: "diag",
        code: "W1557",
        message: expect.stringMatching(/^secure: .*createApp\(\{ secure: true \}\)$/),
        see: "k.server",
      },
    ]);
    const both: string[] = [];
    await app({ assets: built(), lines: both });
    expect(both.map((l) => JSON.parse(l).code)).toEqual(["W1556", "W1557"]);
    const quiet: string[] = [];
    await app({ assets: built(), lines: quiet, secret: "s".repeat(32), secure: false });
    await app({ assets: built(), lines: quiet, secret: "s".repeat(32), mode: "dev" });
    vi.stubEnv("NODE_ENV", "development");
    await app({ lines: quiet, secret: "s".repeat(32) });
    expect(quiet).toEqual([]);
  });

  it("behind a proxy, the public https origin (KEEL_ORIGIN in server.mjs) is the switch: no W1557, and the cookie is Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const lines: string[] = [];
    const a = await app({ assets: built(), lines, secret: "s".repeat(32), origin: "https://a.example" });
    expect(lines).toEqual([]);
    const res = await a.fetch(
      new Request("http://10.0.0.2:8080/", { method: "POST", headers: { origin: "https://a.example" } }),
    );
    expect(res.headers.get("set-cookie") ?? "").toMatch(/^__Host-keel-caller=.*; Secure/);
  });
});

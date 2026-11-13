// k.server Build (RFC 0048, 0052), backlog 0127 and 0147: a production `createApp` without `assets` rejects with E1555
// at startup unless NODE_ENV (trimmed, any case) is `development` or `test`; unset counts as production. Otherwise
// island documents would script the Vite-only `/@keel/entry.ts`. Dev mode and test runs serve the dev entry as before.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { nodeEnv } from "../src/internal/nodeEnv.ts";

const made: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const island = () => {
  const b = document.createElement("button");
  b.setAttribute("data-k", "0");
  b.textContent = "+";
  return b;
};
const plain = () => {
  const p = document.createElement("p");
  p.textContent = "Hello";
  return p;
};
const app = (o: { mode?: "dev" | "production"; assets?: string }) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({
      "app.counter": { path: "/counter", component: island },
      "app.plain": { path: "/plain", component: plain },
    }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...o,
  });
const built = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-prod-assets-"));
  made.push(d);
  fs.mkdirSync(path.join(d, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(d, "assets"), { recursive: true });
  const entry = { "@keel/entry.ts": { file: "assets/entry-abc.js", isEntry: true } };
  fs.writeFileSync(path.join(d, ".vite/manifest.json"), JSON.stringify(entry));
  fs.writeFileSync(path.join(d, "assets/entry-abc.js"), "resume()");
  return d;
};
const moduleSrc = async (a: { fetch(r: Request): Promise<Response> }, p: string): Promise<string | null> => {
  const html = await (await a.fetch(new Request(`http://localhost${p}`))).text();
  return /<script type="module" src="([^"]+)"[^>]*>/.exec(html)?.[1] ?? null;
};

describe("createApp in a deployed production server (backlog 0127, 0147)", () => {
  it.each(["production", "prod", "Production", " PRODUCTION ", "staging", ""])(
    "rejects with E1555 at startup when NODE_ENV is %j and no assets are passed",
    async (env) => {
      vi.stubEnv("NODE_ENV", env);
      await expect(app({})).rejects.toMatchObject({ code: "E1555", message: expect.stringMatching(/^E1555 assets: /) });
      await expect(app({ mode: "production" })).rejects.toMatchObject({ code: "E1555" });
    },
  );

  it("rejects with E1555 at startup when NODE_ENV is unset", async () => {
    vi.stubEnv("NODE_ENV", undefined);
    await expect(app({})).rejects.toMatchObject({ code: "E1555" });
  });

  it("starts with assets and scripts the built entry into island documents only", async () => {
    vi.stubEnv("NODE_ENV", undefined);
    const a = await app({ assets: built() });
    expect(await moduleSrc(a, "/counter")).toBe("/assets/entry-abc.js");
    expect(await moduleSrc(a, "/plain")).toBeNull();
  });

  it("dev mode needs no assets and serves the dev entry, whatever NODE_ENV says", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const a = await app({ mode: "dev" });
    expect(await moduleSrc(a, "/counter")).toBe("/@keel/entry.ts");
    expect((await a.fetch(new Request("http://localhost/@keel/entry.ts"))).status).toBe(200);
  });

  it.each(["development", "test", "Development", " TEST "])(
    "a production app under NODE_ENV %j starts without assets; island-free pages load no JS",
    async (env) => {
      vi.stubEnv("NODE_ENV", env);
      const a = await app({});
      expect(await moduleSrc(a, "/counter")).toBe("/@keel/entry.ts");
      expect(await moduleSrc(a, "/plain")).toBeNull();
    },
  );
});

describe("nodeEnv", () => {
  it("reads NODE_ENV trimmed and lowercased, undefined when unset or when there is no process", () => {
    vi.stubEnv("NODE_ENV", " Production ");
    expect(nodeEnv()).toBe("production");
    vi.stubEnv("NODE_ENV", undefined);
    expect(nodeEnv()).toBeUndefined();
    vi.stubGlobal("process", undefined);
    const none = nodeEnv();
    vi.unstubAllGlobals();
    expect(none).toBeUndefined();
    vi.stubGlobal("process", { env: null });
    const noEnv = nodeEnv();
    vi.unstubAllGlobals();
    expect(noEnv).toBeUndefined();
  });
});

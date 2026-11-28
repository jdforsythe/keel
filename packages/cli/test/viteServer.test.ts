// viteServer: the inline config `keel dev` hands the project's Vite. A stand-in `vite` in a temp project answers
// `createServer` with its argument as `config.server.port`, which `viteServer` hands back unread, and a logger whose
// lines it keeps in `written`.
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { isRecord } from "../src/internal/isRecord.ts";
import { viteServer } from "../src/internal/viteServer.ts";

const VITE = `export const version = "0.0.0";
export const written = [];
export const createServer = (inline) => {
  const config = { server: { port: inline }, logger: { info(msg) { written.push(msg); } } };
  return { config, listen() {}, close() {}, printUrls() { config.logger.info("  \\u001b[32m➜\\u001b[39m  Local: http://127.0.0.1:5999/"); } };
};
`;

let project = "";
beforeAll(() => {
  project = realpathSync(tempDir("keel-vite-server-"));
  mkdirSync(join(project, "node_modules", "vite"), { recursive: true });
  writeFileSync(
    join(project, "node_modules", "vite", "package.json"),
    JSON.stringify({ name: "vite", type: "module", exports: "./index.js" }),
  );
  writeFileSync(join(project, "node_modules", "vite", "index.js"), VITE);
});
afterAll(() => rmSync(project, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());

/** The inline config `createServer` was called with. */
const inline = async (port?: number): Promise<unknown> => (await viteServer(project, port)).port;

describe("viteServer", () => {
  it("asks for a strict port, and the given port when there is one", async () => {
    vi.stubEnv("KEEL_DEV_POLL", "");
    expect(await inline()).toEqual({ root: project, server: { strictPort: true } });
    expect(await inline(4321)).toEqual({ root: project, server: { strictPort: true, port: 4321 } });
  });

  it("asks for a polling watcher, one interval of 100 ms, only when KEEL_DEV_POLL is 1", async () => {
    vi.stubEnv("KEEL_DEV_POLL", "1");
    expect(await inline()).toEqual({
      root: project,
      server: { strictPort: true, watch: { usePolling: true, interval: 100 } },
    });
    for (const off of ["", "0"]) {
      vi.stubEnv("KEEL_DEV_POLL", off);
      expect(await inline(4321)).toEqual({ root: project, server: { strictPort: true, port: 4321 } });
    }
    vi.unstubAllEnvs();
    vi.stubEnv("KEEL_DEV_POLL", undefined);
    expect(await inline()).toEqual({ root: project, server: { strictPort: true } });
  });

  it("writes Vite's lines with no ANSI when plain, and as Vite colored them when not", async () => {
    vi.stubEnv("KEEL_DEV_POLL", "");
    const mod: unknown = await import(pathToFileURL(join(project, "node_modules", "vite", "index.js")).href);
    const written = isRecord(mod) && Array.isArray(mod.written) ? mod.written : [];
    (await viteServer(project, undefined, undefined, true)).printUrls();
    (await viteServer(project, undefined)).printUrls();
    const esc = String.fromCharCode(27);
    expect(written).toEqual([
      "  ➜  Local: http://127.0.0.1:5999/",
      `  ${esc}[32m➜${esc}[39m  Local: http://127.0.0.1:5999/`,
    ]);
  });

  it("throws for any other value, naming the key and not the value", async () => {
    for (const bad of ["true", "yes", "false", "TRUE"]) {
      vi.stubEnv("KEEL_DEV_POLL", bad);
      const e = await viteServer(project, undefined).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(Error);
      expect(String(e)).toContain("KEEL_DEV_POLL");
      expect(String(e)).not.toContain(bad);
    }
  });
});

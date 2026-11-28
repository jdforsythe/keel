// `devRefresh` (k.derived Refresh) over a dev server stand-in and a stand-in `devViews`: each refresh hands the root
// project's routes to the plugin, gives the watcher each input outside the root once whatever the number of refreshes,
// and an event repeating a file's last bytes starts none.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DevServer } from "../src/internal/DevServer.ts";
import { devRefresh } from "../src/internal/devRefresh.ts";

type Views = { runs: number; files: string[]; routes: Readonly<Record<string, unknown>> | null | undefined };
const views = vi.hoisted((): Views => ({ runs: 0, files: [], routes: undefined }));
vi.mock("@keel/cli/derive", () => ({
  devViews: () => {
    views.runs += 1;
    return Promise.resolve({ diags: [], files: views.files, routes: views.routes });
  },
}));

let root = "";
let outside = "";
beforeEach(() => {
  root = fs.realpathSync(tempDir(".tmp-devRefresh-", import.meta.dirname));
  outside = fs.realpathSync(tempDir(".tmp-devRefresh-out-", import.meta.dirname));
  views.runs = 0;
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

/** A dev server stand-in: what was given to its watcher and to the plugin, and a way to send it an event. */
function stand(): {
  server: DevServer;
  watched: string[][];
  handed: unknown[];
  emit: (event: string, file: string) => void;
} {
  const watched: string[][] = [];
  const handed: unknown[] = [];
  let listener: ((event: string, file: string) => void) | undefined;
  const server: DevServer = {
    version: "",
    port: 0,
    host: undefined,
    listen: () => Promise.resolve(),
    loopback: () => Promise.resolve(),
    close: () => Promise.resolve(),
    printUrls: () => undefined,
    info: () => undefined,
    shortcuts: () => undefined,
    onChange: (l) => {
      listener = l;
    },
    watch: (files) => {
      watched.push([...files]);
    },
    derivedRoutes: (routes) => {
      handed.push(routes);
    },
  };
  return { server, watched, handed, emit: (event, file) => listener?.(event, file) };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
};

describe("devRefresh", () => {
  it("gives the watcher each input outside the root once, and hands the routes after every refresh", async () => {
    const own = path.join(root, "modules", "a", "a.contract.ts");
    fs.mkdirSync(path.dirname(own), { recursive: true });
    fs.writeFileSync(own, "1");
    const lib = path.join(outside, "lib.ts");
    fs.writeFileSync(lib, "x");
    views.files = [own, lib];
    views.routes = { "a.home": { path: "/" } };
    const s = stand();
    devRefresh(root, s.server, () => undefined);
    await settle();
    for (const text of ["2", "3"]) {
      fs.writeFileSync(own, text);
      s.emit("change", own);
      await settle();
    }
    expect(views.runs).toBe(3);
    expect(s.watched.flat()).toEqual([lib]);
    expect(s.handed).toEqual([views.routes, views.routes, views.routes]);
  });

  it("an event repeating a file's last bytes starts no refresh; a failed root evaluation hands nothing", async () => {
    const own = path.join(root, "a.contract.ts");
    fs.writeFileSync(own, "1");
    views.files = [own];
    views.routes = null;
    const s = stand();
    devRefresh(root, s.server, () => undefined);
    await settle();
    fs.writeFileSync(own, "2");
    s.emit("change", own);
    await settle();
    s.emit("change", own);
    await settle();
    expect(views.runs).toBe(2);
    expect(s.handed).toEqual([]);
  });
});

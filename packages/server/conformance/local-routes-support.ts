// Shared fixture for the k.contract Local routes conformance files that need a real connection (not a test file). Seed for every property: 1337.
// Method: the real `keel build` over a temp project of one `node` deployable `web` (module `app`), then `node dist/web/server.mjs` as a child on a free port with
// `HOST` unset, so the connection's remote address is the one the test connects from (`127.0.0.1`, `::1` or the machine's own non-loopback address).
// The fixture's handlers each count their own runs in `state.server.ts` and the non-local `GET /api/counts` reports them, so "the handler never ran" is read from
// outside: `app.panel` is a `local: true` page with a loader, `app.probe` a `local: true` API GET with a guard and a loader, `app.mutate` a `local: true` API POST
// with an action, `app.open` and `app.counts` are API GETs that are not local.
// ASSUMED: a runtime (JSON) GET of an API entry answers `{ id, results: { <id>: { ok, value } } }` (read from a run of the fixture; the spec names no shape the cases depend on beyond the handler's value being in the body).
// ASSUMED (the spec names no seam for it): a connection from the machine's own non-loopback address is made by connecting to that address, whose remote address
// the server sees as that address; the child answers once `GET /api/counts` does (bounded retry, no timers).
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { deployEnv, REPO } from "./topology-build-fixture.ts";

export const SEED = 1337; // seed 1337

const write = (root: string, rel: string, content: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const link = (target: string, at: string): void => {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
};

const PANEL = `import { Box, Text } from "@keel/ui";
export default function Panel() {
  return <Box><Text id="app.marker">panel</Text></Box>
}
`;
const PANEL_SCHEMA = `import { s } from "@keel/schema";
export const Panel = s.object({ marker: s.string() });
`;
const COUNTS_SCHEMA = `import { s } from "@keel/schema";
export const Counts = s.object({ page: s.int(), guard: s.int(), probe: s.int(), act: s.int(), open: s.int() });
`;
const CONTRACT = `import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { Counts } from "./Counts.schema.ts";
import { Panel } from "./Panel.schema.ts";
export const app = contract("app", {
  "app.panel": { path: "/panel", local: true },
  "app.probe": { method: "GET", path: "/api/probe", output: Panel, local: true },
  "app.mutate": { method: "POST", path: "/api/mutate", body: s.object({ note: s.string() }), output: s.object({}), local: true },
  "app.open": { method: "GET", path: "/api/open", output: Panel },
  "app.counts": { method: "GET", path: "/api/counts", output: Counts },
});
`;
const STATE = `export const state = { page: 0, guard: 0, probe: 0, act: 0, open: 0 };
`;
const HANDLERS: Record<string, string> = {
  "gate.guard.ts": `import { guard } from "@keel/router";
import { ok } from "@keel/schema";
import { state } from "./state.server.ts";
export const gate = guard({}, async () => {
  state.guard += 1;
  return ok(null);
});
`,
  "panel.server.ts": `import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Panel } from "./Panel.schema.ts";
import { app } from "./app.contract.ts";
import { state } from "./state.server.ts";
export const panel = loader(app, "app.panel", { output: Panel }, async () => {
  state.page += 1;
  return ok({ marker: "PANEL_MARKER_7f3a91" });
});
`,
  "probe.server.ts": `import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { app } from "./app.contract.ts";
import { state } from "./state.server.ts";
export const probe = loader(app, "app.probe", {}, async () => {
  state.probe += 1;
  return ok({ marker: "PROBE_MARKER_c20d48" });
});
`,
  "mutate.server.ts": `import { action } from "@keel/router";
import { ok } from "@keel/schema";
import { app } from "./app.contract.ts";
import { state } from "./state.server.ts";
export const mutate = action(app, "app.mutate", {}, async () => {
  state.act += 1;
  return ok({});
});
`,
  "open.server.ts": `import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { app } from "./app.contract.ts";
import { state } from "./state.server.ts";
export const open = loader(app, "app.open", {}, async () => {
  state.open += 1;
  return ok({ marker: "OPEN_MARKER_58be10" });
});
`,
  "counts.server.ts": `import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { app } from "./app.contract.ts";
import { state } from "./state.server.ts";
export const counts = loader(app, "app.counts", {}, async () => ok({ ...state }));
`,
};
const ROUTES = `import { manifest } from "@keel/router";
import { app } from "./app.contract.ts";
import Panel from "./Panel.tsx";
import { gate } from "./gate.guard.ts";
import { counts } from "./counts.server.ts";
import { mutate } from "./mutate.server.ts";
import { open } from "./open.server.ts";
import { panel } from "./panel.server.ts";
import { probe } from "./probe.server.ts";
export const routes = manifest(app, {
  "app.panel": { component: Panel, loader: panel },
  "app.probe": { loader: probe, guard: gate },
  "app.mutate": { action: mutate, guard: gate },
  "app.open": { loader: open },
  "app.counts": { loader: counts },
});
`;

export type Built = { root: string; status: number | null; out: string };

/** The fixture project built by the real `keel build`; the caller removes `root`. */
export const buildFixture = (): Built => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-local-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"])
    link(path.join(REPO, "packages", p), path.join(root, "node_modules", "@keel", p));
  link(path.join(REPO, "node_modules", "vite"), path.join(root, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(root, "node_modules", ".bin", "vite"));
  write(root, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    root,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node" } });\n',
  );
  write(
    root,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "@keel/runtime-dom",
        module: "esnext",
        target: "es2022",
        moduleResolution: "bundler",
      },
    }),
  );
  write(
    root,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(root, "modules/app/Panel.tsx", PANEL);
  write(root, "modules/app/app.contract.ts", CONTRACT);
  write(root, "modules/app/state.server.ts", STATE);
  write(root, "modules/app/Panel.schema.ts", PANEL_SCHEMA);
  write(root, "modules/app/Counts.schema.ts", COUNTS_SCHEMA);
  for (const [name, text] of Object.entries(HANDLERS)) write(root, `modules/app/${name}`, text);
  write(root, "modules/app/routes.ts", ROUTES);
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: root,
    encoding: "utf8",
    env: deployEnv({ KEEL_AGENT: "1" }),
  });
  return { root, status: r.status, out: `${r.stdout}${r.stderr}` };
};

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

export type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string };
export type Ask = {
  /** The address the connection is made to, hence the remote address the server sees it from: `127.0.0.1`, `::1` or the machine's own. */
  from?: string;
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
};

/** One request over a real connection; `Host` and every other header are the test's. */
export const ask = (port: number, a: Ask): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: a.from ?? "127.0.0.1", port, method: a.method ?? "GET", path: a.path, headers: a.headers ?? {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end(a.body);
  });

export type Counts = {
  page: number;
  guard: number;
  probe: number;
  act: number;
  open: number;
};
const isCounts = (v: unknown): v is Counts =>
  typeof v === "object" &&
  v !== null &&
  ["page", "guard", "probe", "act", "open"].every((k) => typeof Reflect.get(v, k) === "number");

/** The fixture's own run counts, asked over a loopback connection of a non-local route. */
export const counts = async (port: number): Promise<Counts> => {
  const r = await ask(port, {
    path: "/api/counts",
    headers: { host: `127.0.0.1:${port}`, accept: "application/json", "sec-fetch-site": "none" },
  });
  const doc: unknown = JSON.parse(r.body);
  const results: unknown = typeof doc === "object" && doc !== null ? Reflect.get(doc, "results") : undefined;
  const one: unknown = typeof results === "object" && results !== null ? Reflect.get(results, "app.counts") : undefined;
  const v: unknown = typeof one === "object" && one !== null ? Reflect.get(one, "value") : undefined;
  if (!isCounts(v)) throw new Error(`counts: ${r.status} ${r.body.slice(0, 200)}`);
  return v;
};

export type Running = { port: number; stop: () => void; out: () => string };

/** `node dist/web/server.mjs` of `root` on a free port with `HOST` unset; waits until it answers (bounded retry, no timers). */
export const startServer = async (root: string, extra: Record<string, string> = {}): Promise<Running> => {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [path.join(root, "dist", "web", "server.mjs")], {
    cwd: root,
    env: deployEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), ...extra }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout?.on("data", (c: Buffer) => {
    out += c.toString("utf8");
  });
  child.stderr?.on("data", (c: Buffer) => {
    out += c.toString("utf8");
  });
  let up = false;
  for (let i = 0; i < 4000 && !up; i++) {
    up = await ask(port, { path: "/api/counts", headers: { accept: "application/json" } }).then(
      () => true,
      () => false,
    );
  }
  if (!up) {
    child.kill("SIGKILL");
    throw new Error(`server did not answer: ${out.slice(-400)}`);
  }
  return { port, stop: () => child.kill("SIGTERM"), out: () => out };
};

/** The machine's first non-loopback IPv4 address, or none. */
export const LAN: string | undefined = Object.values(os.networkInterfaces())
  .flatMap((a) => a ?? [])
  .find((i) => !i.internal && i.family === "IPv4")?.address;
/** Whether this machine has an IPv6 loopback address. */
export const HAS_V6: boolean = Object.values(os.networkInterfaces())
  .flatMap((a) => a ?? [])
  .some((i) => i.family === "IPv6" && i.address === "::1");

/** Headers of a request that satisfies all three conditions at `host:port`. */
export const good = (host: string, port: number, extra: Record<string, string> = {}): Record<string, string> => ({
  host: `${host}:${port}`,
  accept: "application/json",
  "sec-fetch-site": "none",
  ...extra,
});

export const REMOVE = (root: string): void => fs.rmSync(root, { recursive: true, force: true });

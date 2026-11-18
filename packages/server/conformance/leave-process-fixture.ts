// A `keel build` fixture whose loaders end in uncaught errors, and a child-process driver for its `server.mjs` (not a test file).
// Pattern of topology-build-fixture.ts. Every child listens on a port the OS just freed, never a fixed one, and is killed by its test.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { REPO, deployEnv } from "./topology-build-fixture.ts";

export const SEED = 1337;
/** The text a thrown error carries; no record may hold it. */
export const THROWN = "planted-thrown-text";
/** What the fixture's own timers are called, spelled so the fixture's source is data here. */
const TIMER = ["set", "Timeout"].join("");

const ROUTES = `import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
const Data = s.object({ title: s.string() });
const Home = () => null;
const answer = (title) => Promise.resolve(ok({ title }));
// The work a request starts: each timer throws after the response has gone out.
const throwLater = (...delays) => {
  for (const ms of delays) ${TIMER}(() => { throw new Error(${JSON.stringify(THROWN)}); }, ms);
};
const late = loader({ output: Data }, () => { throwLater(30); return answer("late"); });
const twice = loader({ output: Data }, () => { throwLater(30, 40); return answer("twice"); });
const slow = loader({ output: Data }, () => new Promise((resolve) => {
  process.stdout.write("slow-started\\n");
  ${TIMER}(() => resolve(ok({ title: "slow" })), 500);
}));
const hang = loader({ output: Data }, () => new Promise(() => undefined));
const quiet = loader({ output: Data }, () => answer("quiet"));
if (process.env.LEAVE_MODE === "reject") void Promise.reject(new Error(${JSON.stringify(THROWN)}));
export const routes = manifest({
  "app.home": { path: "/", component: Home, loader: quiet },
  "app.late": { path: "/late", component: Home, loader: late },
  "app.twice": { path: "/twice", component: Home, loader: twice },
  "app.slow": { path: "/slow", component: Home, loader: slow },
  "app.hang": { path: "/hang", component: Home, loader: hang },
});
`;

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function link(target: string, at: string): void {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
}

/** Builds the fixture with the real CLI and returns its root; the caller removes it. */
export function buildLeaveFixture(): string {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-leave-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server"]) {
    link(path.join(REPO, "packages", p), path.join(fixture, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(fixture, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(fixture, "node_modules", ".bin", "vite"));
  write(fixture, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    fixture,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node" } });\n',
  );
  write(
    fixture,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    fixture,
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
    fixture,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [], routes: [] } });\n',
  );
  write(fixture, "modules/app/routes.ts", ROUTES);
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  if (r.status !== 0) throw new Error(`keel build failed (status ${String(r.status)})\n${r.stdout}\n${r.stderr}`);
  return fixture;
}

export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

/** A json record of the server's log, as far as these tests read it. */
export type LogRecord = {
  readonly kind: string;
  readonly code?: string;
  readonly message?: string;
  readonly frames?: unknown;
};

function recordOf(line: string): LogRecord | undefined {
  if (!line.startsWith("{")) return undefined;
  try {
    const v: unknown = JSON.parse(line);
    if (typeof v !== "object" || v === null) return undefined;
    const kind: unknown = Reflect.get(v, "kind");
    if (typeof kind !== "string") return undefined;
    const code: unknown = Reflect.get(v, "code");
    const message: unknown = Reflect.get(v, "message");
    return {
      kind,
      ...(typeof code === "string" ? { code } : {}),
      ...(typeof message === "string" ? { message } : {}),
      frames: Reflect.get(v, "frames"),
    };
  } catch {
    return undefined;
  }
}

export type Server = {
  readonly port: number;
  readonly child: ChildProcess;
  /** Every line written to stdout and stderr so far. */
  readonly text: () => string;
  /** The json records written so far. */
  readonly records: () => LogRecord[];
  readonly e1577: () => LogRecord[];
  /** Resolves true once `pred` holds (checked on every chunk of output), false if the process exits first. */
  readonly until: (pred: () => boolean) => Promise<boolean>;
  readonly exited: Promise<number | null>;
  readonly stop: () => void;
};

/** Starts `dist/web/server.mjs` of `fixture` in json format on a free port. */
export async function startServer(fixture: string, extra: Record<string, string> = {}): Promise<Server> {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(fixture, "dist", "web", "server.mjs")], {
    cwd: fixture,
    env: deployEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), KEEL_FORMAT: "json", ...extra }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let buf = "";
  const waiters: (() => void)[] = [];
  const onData = (d: Buffer): void => {
    buf += d.toString();
    for (const w of [...waiters]) w();
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  const exited = new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
  const records = (): LogRecord[] =>
    buf
      .split("\n")
      .map(recordOf)
      .filter((r): r is LogRecord => r !== undefined);
  return {
    port,
    child,
    text: () => buf,
    records,
    e1577: () => records().filter((r) => r.kind === "diag" && r.code === "E1577"),
    until: (pred) =>
      new Promise<boolean>((resolve) => {
        if (pred()) return resolve(true);
        const check = (): void => {
          if (pred()) resolve(true);
        };
        waiters.push(check);
        void exited.then(() => resolve(pred()));
      }),
    exited,
    stop: () => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    },
  };
}

/** One GET of `pathname` on `port`: the status, or 0 when the connection fails. */
export const statusOf = (port: number, pathname: string): Promise<number> =>
  fetch(`http://127.0.0.1:${port}${pathname}`).then(
    (r) => r.status,
    () => 0,
  );

/** Retries `statusOf` of `/` until the server answers, bounded by a count of attempts. */
export async function listening(server: Server): Promise<boolean> {
  for (let i = 0; i < 4000 && server.child.exitCode === null; i++) {
    if ((await statusOf(server.port, "/")) === 200) return true;
  }
  return false;
}

/** Whether a TCP connection to `port` is refused. */
export const refused = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" });
    sock.once("connect", () => {
      sock.destroy();
      resolve(false);
    });
    sock.once("error", () => resolve(true));
  });

// True when golden app 3 meets evals/tasks/golden-3/TASK.md acceptance, in this order: the app exists; its files, marks
// and `autocomplete` attributes; no unsafe, `any`, casts or suppressions; the app's `check` script and `keel check`;
// `keel test` (which writes `reports/a11y.json`); transaction properties, every golden-3 ledger item at example or better
// and the ledger not regressed; the build; every a11y claim of the six pages at example; the hidden suite
// (acceptance.test.ts, copied into the app, run, removed), which also writes the canary values; the injected-failure
// twin (a sibling copy whose `signUp` throws with its input, where the log must hold `[pii]` and no value); the browser
// pass (browser.ts); and the evidence bundle, made with a fresh Ed25519 key and the recorded audit fixture, verified by
// keyId, with pii coverage 1 and no canary value in it or under `.keel/sessions/`. A failed gate prints one V0001 line.
import { execFile } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { access, copyFile, cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { browserPass } from "./browser.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const app = join(root, "apps", "golden-3");
const keelBin = join(root, "packages", "cli", "src", "bin.ts");
const vitest = join(root, "node_modules", ".bin", "vitest");
const mod = "modules/shifts";
const ACCEPT = "test/__acceptance.test.ts";
const PAGES = ["shifts.index", "shifts.show", "shifts.mine", "shifts.signup", "shifts.roster", "shifts.attend"];

const FILES: readonly string[] = [
  ...["package.json", "tsconfig.json", "vite.config.ts", "tokens.ts", "topology.ts"],
  ...[
    "module",
    "shifts.contract",
    "routes",
    "board",
    "signUpTx",
    "cancelTx",
    "markAttendedTx",
    "isOrganizer",
    "pageOrigin",
  ].map((n) => `${mod}/${n}.ts`),
  `${mod}/organizer.guard.ts`,
  ...["Shift", "Signup", "SignupDraft", "Attendance", "Board", "ShiftParams", "SignupParams"].map(
    (n) => `${mod}/${n}.schema.ts`,
  ),
  ...[
    "loadIndex",
    "loadShift",
    "loadMine",
    "loadSignup",
    "loadRoster",
    "loadAttend",
    "signUp",
    "cancel",
    "markAttended",
  ].map((n) => `${mod}/${n}.server.ts`),
  ...["AppShell", "IndexPage", "ShiftPage", "MinePage", "SignupPage", "RosterPage", "AttendPage", "ShiftError"].map(
    (n) => `${mod}/${n}.tsx`,
  ),
  ...["board", "routes", "server", "privacy"].map((n) => `test/${n}.test.ts`),
  "test/webRoutes.ts",
];
const PROPERTY_TARGETS: readonly string[] = ["signUpTx", "cancelTx", "markAttendedTx"];
/** Each marked path `pii.json` must list, by schema export. */
const MARKED: Readonly<Record<string, readonly string[]>> = {
  Signup: ["name", "email", "phone", "needs", "owner"],
  SignupDraft: ["name", "email", "phone", "needs"],
};
const AUTOCOMPLETE: readonly string[] = [
  'autocomplete="name"',
  'autocomplete="email"',
  'autocomplete="tel"',
  'autocomplete="off"',
];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage|reports|evidence)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;
const BANNED = /\bunsafe\(|@ts-ignore|@ts-expect-error|\bas any\b|:\s*any\b|\bas unknown as\b/;
const TWIN_SKIP: ReadonlySet<string> = new Set(["node_modules", "dist", ".keel", ".turbo", "reports", "evidence"]);

type Run = { ok: boolean; stdout: string };

const sh = (cmd: string, args: string[], cwd = root, extra: Record<string, string> = {}): Promise<Run> =>
  new Promise((resolve) => {
    const env = { ...process.env, KEEL_AGENT: "1", ...extra };
    execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env }, (err, stdout) =>
      resolve({ ok: err === null, stdout: String(stdout) }),
    );
  });

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Prints the one line that says which gate failed, and fails. */
const fail = (why: string): false => {
  process.stderr.write(`V0001 evals/tasks/golden-3 ${why}\n`);
  return false;
};

/** Walks `dir` without descending into node_modules, .keel, dist, coverage, reports or evidence. */
async function codeFiles(dir = "", out: string[] = []): Promise<string[]> {
  for (const e of await readdir(join(app, dir), { withFileTypes: true })) {
    const rel = dir === "" ? e.name : `${dir}/${e.name}`;
    if (SKIP_DIR.test(rel)) continue;
    if (e.isDirectory()) await codeFiles(rel, out);
    else if (CODE.test(rel)) out.push(rel);
  }
  return out.sort();
}

/** Every file under `dir`, recursively, as absolute paths. */
async function allFiles(dir: string, out: string[] = []): Promise<string[]> {
  if (!(await exists(dir))) return out;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await allFiles(p, out);
    else out.push(p);
  }
  return out;
}

/** The JSON records `keel ledger --format=json --scope <scope>` prints from the repo root. */
async function ledger(scope: string): Promise<Record<string, unknown>[]> {
  const r = await sh("node", [keelBin, "ledger", "--format=json", "--scope", scope]);
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map(parse)
    .filter(isRecord);
}

/** The six pages are page routes of the build's `routes.json`, and each has a11y claims, all at example. */
async function a11yClaims(): Promise<string | undefined> {
  const routes = parse(await readFile(join(app, ".keel", "routes.json"), "utf8").catch(() => ""));
  const data = isRecord(routes) && isRecord(routes.data) ? routes.data : {};
  const pages = Object.entries(data)
    .filter(([, v]) => isRecord(v) && typeof v.path === "string" && v.api !== true)
    .map(([k]) => k);
  for (const p of PAGES) if (!pages.includes(p)) return `routes.json has no page ${p}`;
  const items = (await ledger("a11y:")).filter((r) => r.kind === "ledger" && typeof r.item === "string");
  for (const p of pages) {
    const mine = items.filter((r) => String(r.item).startsWith(`a11y:${p}#`));
    if (mine.length === 0) return `no a11y claim for ${p}`;
    const low = mine.find((r) => r.rung !== "example");
    if (low !== undefined) return `${String(low.item)} is at ${String(low.rung)}`;
  }
  return undefined;
}

/** The hidden suite in the app, with the canary values written to `canaryFile`. */
async function acceptance(canaryFile: string): Promise<boolean> {
  const target = join(app, ACCEPT);
  await copyFile(join(here, "acceptance.test.ts"), target);
  const r = await sh("pnpm", ["--filter", "golden-3", "exec", "vitest", "run", ACCEPT], root, {
    KEEL_CANARY_OUT: canaryFile,
  }).finally(() => rm(target, { force: true }));
  return r.ok;
}

/**
 * The injected failure: a sibling copy (so tsconfig, `node_modules` and workspace paths resolve as for the app) whose
 * `signUp` action throws an `Error` whose message is its decoded input, then the hidden suite's "golden-3 injected"
 * test with `KEEL_TWIN=throw`. A plant that changes nothing fails the twin.
 */
async function injectedTwin(): Promise<string | undefined> {
  const dir = await mkdtemp(join(root, "apps", ".golden-3-twin-"));
  try {
    await cp(app, dir, { recursive: true, filter: (src) => !TWIN_SKIP.has(basename(src)) });
    await symlink(join(app, "node_modules"), join(dir, "node_modules"));
    const file = join(dir, mod, "signUp.server.ts");
    const src = await readFile(file, "utf8");
    const planted = src.replace(
      /(action\([\s\S]*?,\s*(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)[^)]*\)\s*=>\s*\{)/,
      (_m, head: string, input: string) => `${head}\n  throw new Error(JSON.stringify(${input}));`,
    );
    if (planted === src) return "signUp.server.ts has no action whose input is a named parameter";
    await writeFile(file, planted);
    await copyFile(join(here, "acceptance.test.ts"), join(dir, ACCEPT));
    const r = await sh(vitest, ["run", ACCEPT, "-t", "golden-3 injected"], dir, { KEEL_TWIN: "throw" });
    return r.ok ? undefined : "the injected failure logged a marked value or no [pii]";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** `keel evidence` with a fresh key and the audit fixture, `--verify` by keyId, then the bundle's contents. */
async function evidence(canaries: readonly string[]): Promise<string | undefined> {
  const dir = await mkdtemp(join(tmpdir(), "golden-3-evidence-"));
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const keyId = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    const out = join(dir, "bundle");
    const made = await sh("node", [keelBin, "evidence", "--out", out, "--audit", join(here, "audit.json")], app, {
      KEEL_EVIDENCE_KEY: pem,
    });
    if (!made.ok) return `keel evidence failed: ${made.stdout.trim().split("\n").at(-1) ?? ""}`;
    const verified = await sh("node", [keelBin, "evidence", "--verify", out, "--key", keyId], app);
    if (!verified.ok) return `keel evidence --verify failed: ${verified.stdout.trim().split("\n").at(-1) ?? ""}`;
    const pii = parse(await readFile(join(out, "pii.json"), "utf8"));
    if (!isRecord(pii) || pii.coverage !== 1) return "pii.json coverage is not 1";
    if (!Array.isArray(pii.unread) || pii.unread.length > 0) return "pii.json lists schema files it could not read";
    const listed = Array.isArray(pii.paths) ? pii.paths.filter(isRecord) : [];
    for (const [exp, paths] of Object.entries(MARKED))
      for (const p of paths)
        if (!listed.some((x) => x.export === exp && x.path === p)) return `pii.json does not list ${exp} ${p}`;
    const deps = parse(await readFile(join(out, "deps.json"), "utf8"));
    if (!isRecord(deps) || !Array.isArray(deps.advisories)) return "deps.json has no advisories";
    const searched = [...(await allFiles(out)), ...(await allFiles(join(app, ".keel", "sessions")))];
    for (const f of searched) {
      const text = await readFile(f, "utf8");
      if (canaries.some((v) => text.includes(v))) return `${basename(f)} holds a canary value`;
    }
    return undefined;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export default async (): Promise<boolean> => {
  if (!(await exists(app))) return fail("apps/golden-3 is absent: build it with --runner claude first");
  for (const f of FILES) if (!(await exists(join(app, f)))) return fail(`missing ${f}`);

  const files = (await codeFiles()).filter((f) => f !== ACCEPT);
  const text = new Map<string, string>();
  for (const f of files) text.set(f, await readFile(join(app, f), "utf8"));
  const all = (pick: (f: string) => boolean): string =>
    [...text]
      .filter(([f]) => pick(f))
      .map(([, t]) => t)
      .join("\n");
  if (BANNED.test(all(() => true))) return fail("unsafe, any, a cast or a suppression in the app");
  for (const s of ["Signup", "SignupDraft"])
    if (!(text.get(`${mod}/${s}.schema.ts`) ?? "").includes(".pii(")) return fail(`${s} has no .pii() mark`);
  const form = text.get(`${mod}/ShiftPage.tsx`) ?? "";
  for (const a of AUTOCOMPLETE) if (!form.includes(a)) return fail(`ShiftPage.tsx has no ${a}`);
  const tests = all((f) => f.startsWith("test/"));
  if (!tests.includes("@keel/testing")) return fail("no test imports @keel/testing");
  for (const t of PROPERTY_TARGETS)
    if (!new RegExp(`\\bproperties\\([^;]*\\b${t}\\b`).test(tests)) return fail(`no properties( for ${t}`);

  if (!(await sh("pnpm", ["--filter", "golden-3", "check"])).ok) return fail("the app's check script failed");
  if (!(await sh("node", [keelBin, "check", "--quiet"], app)).ok) return fail("keel check failed");
  if (!(await sh("node", [keelBin, "test", "--quiet"], app)).ok) return fail("keel test failed");
  if (!(await exists(join(app, "reports", "a11y.json")))) return fail("keel test wrote no reports/a11y.json");
  if (!(await sh("pnpm", ["ledger", "--diff", "--scope", "golden-3:"])).ok) return fail("ledger --diff regressed");
  const items = (await ledger("golden-3:")).filter((r) => r.kind === "ledger");
  if (items.length === 0) return fail("the ledger has no golden-3 item");
  const none = items.find((r) => r.rung === "none");
  if (none !== undefined) return fail(`${String(none.item)} is at rung none`);
  if (!(await sh("pnpm", ["--filter", "golden-3", "build"])).ok) return fail("the build failed");
  if (!(await exists(join(app, "dist", "web", "server.mjs")))) return fail("no dist/web/server.mjs");

  const claims = await a11yClaims();
  if (claims !== undefined) return fail(claims);
  const scratch = await mkdtemp(join(tmpdir(), "golden-3-canary-"));
  try {
    const canaryFile = join(scratch, "canary.txt");
    if (!(await acceptance(canaryFile))) return fail("the hidden suite failed");
    const canaries = (await readFile(canaryFile, "utf8").catch(() => "")).split("\n").filter((v) => v.length >= 8);
    if (canaries.length < (MARKED.SignupDraft ?? []).length) return fail("the canary run wrote no values");
    const twin = await injectedTwin();
    if (twin !== undefined) return fail(twin);
    const browser = await browserPass(root, app);
    if (browser !== undefined) return fail(`browser pass: ${browser}`);
    const bundle = await evidence(canaries);
    if (bundle !== undefined) return fail(bundle);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return true;
};
